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
      
      // Get segment to check threshold_value
      const [segmentData] = await pool.execute(
        'SELECT threshold_value FROM segments WHERE id = ?',
        [segment_id]
      );
      const threshold_value = segmentData[0]?.threshold_value || 100;
      
      // Update lesson submission with threshold check
      const result = await LessonSubmission.updateProgress(user_id, segment_id, progress_percentage, threshold_value);
      
      // Update all progress (segment -> topic -> course)
      await ProgressService.updateLessonProgress(user_id, segment_id, result?.progress_percentage || progress_percentage, time_spent_seconds);
      
      // Get updated submission
      const submission = await LessonSubmission.findByUserAndSegment(user_id, segment_id);
      
      res.json({
        success: true,
        message: 'Progress updated',
        submission,
        threshold_value,
        is_complete: result?.status === 'completed'
      });
    } catch (error) {
      console.error('Update lesson progress error:', error);
      res.status(500).json({ error: 'Failed to update progress' });
    }
  }

  /**
   * Update media progress (for video/audio)
   * POST /api/submissions/lesson/media-progress
   */
  static async updateMediaProgress(req, res) {
    try {
      const { segment_id, current_position, total_duration, topic_id, course_id } = req.body;
      const user_id = req.user.id;
      
      if (!segment_id || current_position === undefined || total_duration === undefined) {
        return res.status(400).json({ error: 'segment_id, current_position, and total_duration are required' });
      }
      
      // First ensure submission exists (create if needed)
      if (topic_id && course_id) {
        await LessonSubmission.createOrUpdate({
          user_id,
          segment_id,
          topic_id,
          course_id
        });
      }
      
      // Get segment to check threshold_value
      const [segmentData] = await pool.execute(
        'SELECT threshold_value, topic_id FROM segments WHERE id = ?',
        [segment_id]
      );
      const threshold_value = segmentData[0]?.threshold_value || 100;
      const segmentTopicId = segmentData[0]?.topic_id;
      
      // Update media progress
      const result = await LessonSubmission.updateMediaProgress(
        user_id, 
        segment_id, 
        current_position, 
        total_duration, 
        threshold_value
      );
      
      if (result) {
        // Update all progress (segment -> topic -> course)
        await ProgressService.updateLessonProgress(user_id, segment_id, result.progress_percentage, 0);
      }
      
      // Get updated submission
      const submission = await LessonSubmission.findByUserAndSegment(user_id, segment_id);
      
      res.json({
        success: true,
        message: 'Media progress updated',
        submission,
        threshold_value,
        progress_percentage: result?.progress_percentage || 0,
        is_complete: result?.status === 'completed'
      });
    } catch (error) {
      console.error('Update media progress error:', error);
      res.status(500).json({ error: 'Failed to update media progress' });
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
   * Mark a question as attempted in a practice segment
   * POST /api/submissions/practice/attempt
   */
  static async attemptQuestion(req, res) {
    try {
      const { question_id, question_type, practice_segment_id, course_id } = req.body;
      const user_id = req.user.id;

      if (!question_id || !question_type || !practice_segment_id || !course_id) {
        return res.status(400).json({ error: 'question_id, question_type, practice_segment_id, and course_id are required' });
      }

      if (question_type === 'PROGRAMMING') {
        await ProgrammingSubmission.markAttempted({
          user_id,
          course_id,
          practice_segment_id,
          programming_question_id: question_id
        });
      } else if (question_type === 'MCQ') {
        await MCQSubmission.markAttempted({
          user_id,
          course_id,
          practice_segment_id,
          mcq_question_id: question_id
        });
      }

      res.json({ success: true, message: 'Question marked as attempted' });
    } catch (error) {
      console.error('Attempt question error:', error);
      res.status(500).json({ error: 'Failed to mark question as attempted' });
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
      const submission = await ProgrammingSubmission.findByUserAndQuestion(
        user_id,
        programming_question_id,
        { practice_segment_id }
      );
      
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
      
      // Get MCQ question record
      const [mcqQuestionData] = await pool.execute(
        `SELECT mcq.id as mcq_id, mcq.is_multi_select, q.points
         FROM mcq_multiselect_questions mcq 
         JOIN questions q ON mcq.question_id = q.id
         WHERE mcq.question_id = ?`,
        [mcq_question_id]
      );
      
      let correct_options = [];
      let is_correct = false;
      let score = 0;
      let maxScore = 100;
      
      if (mcqQuestionData.length > 0) {
        const mcqId = mcqQuestionData[0].mcq_id;
        maxScore = mcqQuestionData[0].points || 100;
        
        // Get correct options from the options table
        const [correctOptionsData] = await pool.execute(
          `SELECT id FROM options WHERE mcq_multiselect_question_id = ? AND is_correct = 1`,
          [mcqId]
        );
        
        correct_options = correctOptionsData.map(opt => opt.id);
        
        // Check if answer is correct
        const selectedSet = new Set(selected_options);
        const correctSet = new Set(correct_options);
        
        is_correct = selectedSet.size === correctSet.size && 
                     [...selectedSet].every(opt => correctSet.has(opt));
        
        // Calculate score (full score if correct, 0 if incorrect)
        score = is_correct ? maxScore : 0;
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
        max_score: maxScore,
        time_spent_seconds
      });
      
      // Update progress
      await ProgressService.updateMCQProgress(user_id, practice_segment_id);
      
      // Calculate and update overall quiz statistics
      const quizStats = await MCQSubmission.getPracticeSegmentProgress(user_id, practice_segment_id);
      
      // Get total questions in practice segment
      const [totalQuestionsData] = await pool.execute(
        `SELECT COUNT(*) as total FROM practice_segment_mcq_questions WHERE practice_segment_id = ?`,
        [practice_segment_id]
      );
      const totalQuestions = totalQuestionsData[0]?.total || 0;
      
      // Calculate percentage
      const percentage = totalQuestions > 0 
        ? Math.round((quizStats.correct / totalQuestions) * 100) 
        : 0;
      
      // Get updated submission
      const submission = await MCQSubmission.findByUserAndQuestion(
        user_id,
        mcq_question_id,
        { practice_segment_id }
      );
      
      res.json({
        success: true,
        message: 'Answer submitted',
        submission,
        result: {
          is_correct,
          score,
          max_score: maxScore,
          correct_options // Send back for feedback
        },
        quizProgress: {
          totalQuestions,
          totalAttempted: quizStats.total_attempted,
          totalCorrect: quizStats.correct,
          percentage,
          averageScore: quizStats.avg_best_score
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
      
      const {
        practice_segment_id,
        assessment_segment_id,
        assessment_user_mapping_id
      } = req.query;
      const submission = await ProgrammingSubmission.findByUserAndQuestion(
        user_id,
        parseInt(questionId),
        {
          practice_segment_id: practice_segment_id ? parseInt(practice_segment_id) : null,
          assessment_segment_id: assessment_segment_id ? parseInt(assessment_segment_id) : null,
          assessment_user_mapping_id: assessment_user_mapping_id ? parseInt(assessment_user_mapping_id) : null
        }
      );
      
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
      
      const {
        practice_segment_id,
        assessment_segment_id,
        assessment_user_mapping_id
      } = req.query;
      const submission = await MCQSubmission.findByUserAndQuestion(
        user_id,
        parseInt(questionId),
        {
          practice_segment_id: practice_segment_id ? parseInt(practice_segment_id) : null,
          assessment_segment_id: assessment_segment_id ? parseInt(assessment_segment_id) : null,
          assessment_user_mapping_id: assessment_user_mapping_id ? parseInt(assessment_user_mapping_id) : null
        }
      );
      
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

