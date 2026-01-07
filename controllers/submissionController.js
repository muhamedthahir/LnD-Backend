const LessonSubmission = require('../models/LessonSubmission');
const ProgrammingSubmission = require('../models/ProgrammingSubmission');
const MCQSubmission = require('../models/MCQSubmission');
const UserSegmentProgress = require('../models/UserSegmentProgress');
const UserTopicProgress = require('../models/UserTopicProgress');
const ProgressService = require('../services/ProgressService');
const pool = require('../config/db');

class SubmissionController {
  /**
   * Launch/Start a lesson - marks it as in_progress
   * POST /api/submissions/lesson/start
   */
  static async startLesson(req, res) {
    try {
      const { segment_id, topic_id, course_id } = req.body;
      const user_id = req.user.id;
      
      if (!segment_id || !topic_id || !course_id) {
        return res.status(400).json({ error: 'segment_id, topic_id, and course_id are required' });
      }
      
      // Create or update lesson submission (marks as in_progress)
      const submissionId = await LessonSubmission.createOrUpdate({
        user_id,
        segment_id,
        topic_id,
        course_id
      });
      
      // Initialize segment progress if not exists
      await UserSegmentProgress.createOrUpdate({
        user_id,
        course_id,
        topic_id,
        segment_id,
        segment_type: 'lesson',
        status: 'in_progress',
        progress_percentage: 0,
        items_total: 1
      });
      
      // Initialize topic progress if not exists
      await UserTopicProgress.recalculateFromSegments(user_id, topic_id, course_id);
      
      // Update course progress
      await UserTopicProgress.updateCourseProgress(user_id, course_id);
      
      // Get updated submission
      const submission = await LessonSubmission.findByUserAndSegment(user_id, segment_id);
      
      res.json({
        success: true,
        message: 'Lesson started',
        submission
      });
    } catch (error) {
      console.error('Start lesson error:', error);
      res.status(500).json({ error: 'Failed to start lesson' });
    }
  }

  /**
   * Update lesson progress
   * POST /api/submissions/lesson/progress
   */
  static async updateLessonProgress(req, res) {
    try {
      const { segment_id, progress_percentage, time_spent_seconds = 0 } = req.body;
      const user_id = req.user.id;
      
      if (!segment_id || progress_percentage === undefined) {
        return res.status(400).json({ error: 'segment_id and progress_percentage are required' });
      }
      
      // Update lesson submission
      await LessonSubmission.updateProgress(user_id, segment_id, progress_percentage);
      
      // Update all progress (segment -> topic -> course)
      await ProgressService.updateLessonProgress(user_id, segment_id, progress_percentage, time_spent_seconds);
      
      // Get updated submission
      const submission = await LessonSubmission.findByUserAndSegment(user_id, segment_id);
      
      res.json({
        success: true,
        message: 'Progress updated',
        submission
      });
    } catch (error) {
      console.error('Update lesson progress error:', error);
      res.status(500).json({ error: 'Failed to update progress' });
    }
  }

  /**
   * Mark lesson as complete
   * POST /api/submissions/lesson/complete
   */
  static async completeLesson(req, res) {
    try {
      const { segment_id } = req.body;
      const user_id = req.user.id;
      
      if (!segment_id) {
        return res.status(400).json({ error: 'segment_id is required' });
      }
      
      // Mark lesson as complete
      await LessonSubmission.markComplete(user_id, segment_id);
      
      // Update all progress
      await ProgressService.updateLessonProgress(user_id, segment_id, 100, 0);
      
      // Get updated submission
      const submission = await LessonSubmission.findByUserAndSegment(user_id, segment_id);
      
      res.json({
        success: true,
        message: 'Lesson completed',
        submission
      });
    } catch (error) {
      console.error('Complete lesson error:', error);
      res.status(500).json({ error: 'Failed to complete lesson' });
    }
  }

  /**
   * Start a practice segment
   * POST /api/submissions/practice/start
   */
  static async startPractice(req, res) {
    try {
      const { practice_segment_id, course_id } = req.body;
      const user_id = req.user.id;
      
      if (!practice_segment_id || !course_id) {
        return res.status(400).json({ error: 'practice_segment_id and course_id are required' });
      }
      
      // Get practice segment info
      const [segmentInfo] = await pool.execute(
        'SELECT * FROM practice_segments WHERE id = ?',
        [practice_segment_id]
      );
      
      if (!segmentInfo.length) {
        return res.status(404).json({ error: 'Practice segment not found' });
      }
      
      const topic_id = segmentInfo[0].topic_id;
      
      // Initialize practice segment progress
      await ProgressService.initializePracticeSegmentProgress(user_id, course_id, topic_id, practice_segment_id);
      
      // Get progress
      const progress = await UserSegmentProgress.findByUserAndPracticeSegment(user_id, practice_segment_id);
      
      res.json({
        success: true,
        message: 'Practice segment started',
        progress
      });
    } catch (error) {
      console.error('Start practice error:', error);
      res.status(500).json({ error: 'Failed to start practice' });
    }
  }

  /**
   * Submit programming answer
   * POST /api/submissions/programming/submit
   */
  static async submitProgramming(req, res) {
    try {
      const {
        programming_question_id,
        practice_segment_id,
        course_id,
        submitted_code,
        language_used,
        test_cases_passed = 0,
        test_cases_total = 0,
        execution_time_ms,
        output,
        error_message
      } = req.body;
      const user_id = req.user.id;
      
      if (!programming_question_id || !practice_segment_id || !course_id || !submitted_code) {
        return res.status(400).json({ 
          error: 'programming_question_id, practice_segment_id, course_id, and submitted_code are required' 
        });
      }
      
      // Calculate score (simple: percentage of test cases passed)
      const score = test_cases_total > 0 ? (test_cases_passed / test_cases_total) * 100 : 0;
      const status = test_cases_passed === test_cases_total && test_cases_total > 0 ? 'completed' : 'completed';
      
      // Create or update programming submission
      const submissionId = await ProgrammingSubmission.createOrUpdate({
        user_id,
        course_id,
        programming_question_id,
        practice_segment_id,
        submitted_code,
        language_used,
        status,
        test_cases_passed,
        test_cases_total,
        score,
        execution_time_ms,
        output,
        error_message
      });
      
      // Update progress
      await ProgressService.updateProgrammingProgress(user_id, practice_segment_id);
      
      // Get updated submission
      const submission = await ProgrammingSubmission.findByUserAndQuestion(user_id, programming_question_id);
      
      res.json({
        success: true,
        message: 'Code submitted',
        submission,
        result: {
          test_cases_passed,
          test_cases_total,
          score,
          successful: test_cases_passed === test_cases_total && test_cases_total > 0
        }
      });
    } catch (error) {
      console.error('Submit programming error:', error);
      res.status(500).json({ error: 'Failed to submit code' });
    }
  }

  /**
   * Submit MCQ answer
   * POST /api/submissions/mcq/submit
   */
  static async submitMCQ(req, res) {
    try {
      const {
        mcq_question_id,
        practice_segment_id,
        course_id,
        selected_options,
        time_spent_seconds = 0
      } = req.body;
      const user_id = req.user.id;
      
      if (!mcq_question_id || !practice_segment_id || !course_id || !selected_options) {
        return res.status(400).json({ 
          error: 'mcq_question_id, practice_segment_id, course_id, and selected_options are required' 
        });
      }
      
      // Get correct options for this question
      const [questionData] = await pool.execute(
        `SELECT mq.correct_options 
         FROM mcq_multi_select_questions mq 
         WHERE mq.question_id = ?`,
        [mcq_question_id]
      );
      
      let correct_options = [];
      let is_correct = false;
      let score = 0;
      
      if (questionData.length > 0) {
        correct_options = JSON.parse(questionData[0].correct_options || '[]');
        
        // Check if answer is correct
        const selectedSet = new Set(selected_options);
        const correctSet = new Set(correct_options);
        
        is_correct = selectedSet.size === correctSet.size && 
                     [...selectedSet].every(opt => correctSet.has(opt));
        
        score = is_correct ? 100 : 0;
      }
      
      // Create or update MCQ submission
      const submissionId = await MCQSubmission.createOrUpdate({
        user_id,
        course_id,
        mcq_question_id,
        practice_segment_id,
        selected_options,
        correct_options,
        is_correct,
        score,
        time_spent_seconds
      });
      
      // Update progress
      await ProgressService.updateMCQProgress(user_id, practice_segment_id);
      
      // Get updated submission
      const submission = await MCQSubmission.findByUserAndQuestion(user_id, mcq_question_id);
      
      res.json({
        success: true,
        message: 'Answer submitted',
        submission,
        result: {
          is_correct,
          score,
          correct_options // Send back for feedback
        }
      });
    } catch (error) {
      console.error('Submit MCQ error:', error);
      res.status(500).json({ error: 'Failed to submit answer' });
    }
  }

  /**
   * Get course progress for current user
   * GET /api/submissions/progress/course/:courseId
   */
  static async getCourseProgress(req, res) {
    try {
      const { courseId } = req.params;
      const user_id = req.user.id;
      
      const progress = await ProgressService.getCourseProgress(user_id, parseInt(courseId));
      
      res.json(progress);
    } catch (error) {
      console.error('Get course progress error:', error);
      res.status(500).json({ error: 'Failed to get progress' });
    }
  }

  /**
   * Get segment progress
   * GET /api/submissions/progress/segment/:segmentId
   */
  static async getSegmentProgress(req, res) {
    try {
      const { segmentId } = req.params;
      const user_id = req.user.id;
      
      const progress = await ProgressService.getSegmentProgress(user_id, parseInt(segmentId));
      
      res.json(progress || { status: 'not_started', progress_percentage: 0 });
    } catch (error) {
      console.error('Get segment progress error:', error);
      res.status(500).json({ error: 'Failed to get progress' });
    }
  }

  /**
   * Get practice segment progress with submissions
   * GET /api/submissions/progress/practice/:practiceSegmentId
   */
  static async getPracticeProgress(req, res) {
    try {
      const { practiceSegmentId } = req.params;
      const user_id = req.user.id;
      
      const progress = await ProgressService.getPracticeSegmentProgress(user_id, parseInt(practiceSegmentId));
      
      res.json(progress || { status: 'not_started', progress_percentage: 0, programming_submissions: [], mcq_submissions: [] });
    } catch (error) {
      console.error('Get practice progress error:', error);
      res.status(500).json({ error: 'Failed to get progress' });
    }
  }

  /**
   * Get submission history for a programming question
   * GET /api/submissions/programming/:questionId/history
   */
  static async getProgrammingHistory(req, res) {
    try {
      const { questionId } = req.params;
      const user_id = req.user.id;
      
      const submission = await ProgrammingSubmission.findByUserAndQuestion(user_id, parseInt(questionId));
      
      if (!submission) {
        return res.json({ submission: null, history: [] });
      }
      
      const history = await ProgrammingSubmission.getHistory(submission.id);
      
      res.json({ submission, history });
    } catch (error) {
      console.error('Get programming history error:', error);
      res.status(500).json({ error: 'Failed to get history' });
    }
  }

  /**
   * Get submission history for an MCQ question
   * GET /api/submissions/mcq/:questionId/history
   */
  static async getMCQHistory(req, res) {
    try {
      const { questionId } = req.params;
      const user_id = req.user.id;
      
      const submission = await MCQSubmission.findByUserAndQuestion(user_id, parseInt(questionId));
      
      if (!submission) {
        return res.json({ submission: null, history: [] });
      }
      
      const history = await MCQSubmission.getHistory(submission.id);
      
      res.json({ submission, history });
    } catch (error) {
      console.error('Get MCQ history error:', error);
      res.status(500).json({ error: 'Failed to get history' });
    }
  }
}

module.exports = SubmissionController;

