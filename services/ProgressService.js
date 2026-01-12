const pool = require('../config/db');
const UserSegmentProgress = require('../models/UserSegmentProgress');
const UserTopicProgress = require('../models/UserTopicProgress');
const LessonSubmission = require('../models/LessonSubmission');
const ProgrammingSubmission = require('../models/ProgrammingSubmission');
const MCQSubmission = require('../models/MCQSubmission');

class ProgressService {
  /**
   * Initialize segment progress for a user when they start a course/segment
   * Creates progress records if they don't exist
   */
  static async initializeSegmentProgress(user_id, course_id, topic_id, segment_id, segment_type) {
    const existing = await UserSegmentProgress.findByUserAndSegment(user_id, segment_id);
    
    if (!existing) {
      await UserSegmentProgress.createOrUpdate({
        user_id,
        course_id,
        topic_id,
        segment_id,
        segment_type: 'lesson',
        status: 'not_started',
        progress_percentage: 0,
        items_total: 1
      });
    }
    
    return existing;
  }

  /**
   * Initialize practice segment progress
   */
  static async initializePracticeSegmentProgress(user_id, course_id, topic_id, practice_segment_id) {
    const existing = await UserSegmentProgress.findByUserAndPracticeSegment(user_id, practice_segment_id);
    
    if (!existing) {
      // Get total questions in practice segment
      const [progQuestions] = await pool.execute(
        'SELECT COUNT(*) as count FROM practice_segment_programming_questions WHERE practice_segment_id = ?',
        [practice_segment_id]
      );
      const [mcqQuestions] = await pool.execute(
        'SELECT COUNT(*) as count FROM practice_segment_mcq_questions WHERE practice_segment_id = ?',
        [practice_segment_id]
      );
      
      const totalItems = (progQuestions[0]?.count || 0) + (mcqQuestions[0]?.count || 0);
      
      await UserSegmentProgress.createOrUpdate({
        user_id,
        course_id,
        topic_id,
        practice_segment_id,
        segment_type: 'practice',
        status: 'not_started',
        progress_percentage: 0,
        items_total: totalItems
      });
    }
    
    return existing;
  }

  /**
   * Update progress when a lesson is accessed/completed
   */
  static async updateLessonProgress(user_id, segment_id, progress_percentage, time_spent_seconds = 0) {
    // Get lesson submission to find course/topic info
    const lessonSubmission = await LessonSubmission.findByUserAndSegment(user_id, segment_id);
    if (!lessonSubmission) return;
    
    const { course_id, topic_id } = lessonSubmission;
    
    // Update segment progress
    await UserSegmentProgress.updateLessonProgress(user_id, segment_id, progress_percentage, time_spent_seconds);
    
    // Recalculate topic progress
    await UserTopicProgress.recalculateFromSegments(user_id, topic_id, course_id);
    
    // Update course progress
    await UserTopicProgress.updateCourseProgress(user_id, course_id);
  }

  /**
   * Update progress when a programming submission is made
   */
  static async updateProgrammingProgress(user_id, practice_segment_id) {
    // Get practice segment info
    const [segmentInfo] = await pool.execute(
      'SELECT ps.*, t.course_id FROM practice_segments ps JOIN topics t ON ps.topic_id = t.id WHERE ps.id = ?',
      [practice_segment_id]
    );
    
    if (!segmentInfo.length) return;
    
    const { topic_id, course_id } = segmentInfo[0];
    
    // Get programming progress for this practice segment
    const progProgress = await ProgrammingSubmission.getPracticeSegmentProgress(user_id, practice_segment_id);
    
    // Get MCQ progress for this practice segment
    const mcqProgress = await MCQSubmission.getPracticeSegmentProgress(user_id, practice_segment_id);
    
    // Get total questions
    const [progTotal] = await pool.execute(
      'SELECT COUNT(*) as count FROM practice_segment_programming_questions WHERE practice_segment_id = ?',
      [practice_segment_id]
    );
    const [mcqTotal] = await pool.execute(
      'SELECT COUNT(*) as count FROM practice_segment_mcq_questions WHERE practice_segment_id = ?',
      [practice_segment_id]
    );
    
    // Calculate combined progress
    const programmingData = {
      total: progTotal[0]?.count || 0,
      completed: progProgress?.successful || 0,
      score: 0, // Calculate based on your scoring logic
      maxScore: (progTotal[0]?.count || 0) * 100
    };
    
    const mcqData = {
      total: mcqTotal[0]?.count || 0,
      completed: mcqProgress?.correct || 0,
      score: 0,
      maxScore: (mcqTotal[0]?.count || 0) * 100
    };
    
    // Update practice segment progress
    await UserSegmentProgress.updatePracticeSegmentProgress(user_id, practice_segment_id, programmingData, mcqData);
    
    // Recalculate topic progress
    await UserTopicProgress.recalculateFromSegments(user_id, topic_id, course_id);
    
    // Update course progress
    await UserTopicProgress.updateCourseProgress(user_id, course_id);
  }

  /**
   * Update progress when an MCQ submission is made
   */
  static async updateMCQProgress(user_id, practice_segment_id) {
    // Same logic as programming - they share practice segment
    await this.updateProgrammingProgress(user_id, practice_segment_id);
  }

  /**
   * Get complete progress data for a user's course
   */
  static async getCourseProgress(user_id, course_id) {
    // Get all topics with their progress
    const [topics] = await pool.execute(
      `SELECT t.*, 
              COALESCE(utp.status, 'not_started') as progress_status,
              COALESCE(utp.progress_percentage, 0) as progress_percentage,
              COALESCE(utp.segments_completed, 0) as segments_completed,
              COALESCE(utp.segments_total, 0) as segments_total,
              COALESCE(utp.time_spent_seconds, 0) as time_spent_seconds
       FROM topics t
       LEFT JOIN user_topic_progress utp ON t.id = utp.topic_id AND utp.user_id = ?
       WHERE t.course_id = ?
       ORDER BY t.order_index`,
      [user_id, course_id]
    );
    
    // For each topic, get segment progress
    for (const topic of topics) {
      // Get lesson segments progress
      const [lessons] = await pool.execute(
        `SELECT s.*, 
                COALESCE(usp.status, 'not_started') as progress_status,
                COALESCE(usp.progress_percentage, 0) as progress_percentage,
                COALESCE(usp.time_spent_seconds, 0) as time_spent_seconds
         FROM segments s
         LEFT JOIN user_segment_progress usp ON s.id = usp.segment_id AND usp.user_id = ?
         WHERE s.topic_id = ?
         ORDER BY s.order_index`,
        [user_id, topic.id]
      );
      
      // Get practice segments progress
      const [practices] = await pool.execute(
        `SELECT ps.*, 
                COALESCE(usp.status, 'not_started') as progress_status,
                COALESCE(usp.progress_percentage, 0) as progress_percentage,
                COALESCE(usp.items_completed, 0) as items_completed,
                COALESCE(usp.items_total, 0) as items_total,
                COALESCE(usp.time_spent_seconds, 0) as time_spent_seconds
         FROM practice_segments ps
         LEFT JOIN user_segment_progress usp ON ps.id = usp.practice_segment_id AND usp.user_id = ?
         WHERE ps.topic_id = ?`,
        [user_id, topic.id]
      );
      
      topic.lessons = lessons;
      topic.practice_segments = practices;
    }
    
    // Get overall course progress
    const courseProgress = await UserTopicProgress.getCourseProgressSummary(user_id, course_id);
    
    // Get user_course record
    const [userCourse] = await pool.execute(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [user_id, course_id]
    );
    
    return {
      course_id,
      user_id,
      overall_progress: userCourse[0]?.progress_percentage || 0,
      overall_status: userCourse[0]?.status || 'not_started',
      topics_completed: courseProgress?.completed_topics || 0,
      topics_total: courseProgress?.total_topics || 0,
      total_time_spent: courseProgress?.total_time_spent || 0,
      topics
    };
  }

  /**
   * Get segment-level progress data
   */
  static async getSegmentProgress(user_id, segment_id) {
    const progress = await UserSegmentProgress.findByUserAndSegment(user_id, segment_id);
    return progress;
  }

  /**
   * Get practice segment progress with question details
   */
  static async getPracticeSegmentProgress(user_id, practice_segment_id) {
    const progress = await UserSegmentProgress.findByUserAndPracticeSegment(user_id, practice_segment_id);
    
    // Get programming submissions for this segment
    const programmingSubmissions = await ProgrammingSubmission.findByUserAndPracticeSegment(user_id, practice_segment_id);
    
    // Get MCQ submissions for this segment
    const mcqSubmissions = await MCQSubmission.findByUserAndPracticeSegment(user_id, practice_segment_id);
    
    return {
      ...progress,
      programming_submissions: programmingSubmissions,
      mcq_submissions: mcqSubmissions
    };
  }
}

module.exports = ProgressService;

