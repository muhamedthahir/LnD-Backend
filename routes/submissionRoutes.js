const express = require('express');
const router = express.Router();
const SubmissionController = require('../controllers/submissionController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// =====================================================
// LESSON SUBMISSION ROUTES
// =====================================================

// Start/Launch a lesson (marks as in_progress)
router.post('/lesson/start', SubmissionController.startLesson);

// Update lesson progress
router.post('/lesson/progress', SubmissionController.updateLessonProgress);

// Update media progress (video/audio tracking)
router.post('/lesson/media-progress', SubmissionController.updateMediaProgress);

// Mark lesson as complete
router.post('/lesson/complete', SubmissionController.completeLesson);

// =====================================================
// PRACTICE SEGMENT ROUTES
// =====================================================

// Start a practice segment
router.post('/practice/start', SubmissionController.startPractice);

// Mark question as attempted
router.post('/practice/attempt', SubmissionController.attemptQuestion);

// =====================================================
// PROGRAMMING SUBMISSION ROUTES
// =====================================================

// Save programming code draft (no grading)
router.post('/programming/save-code', SubmissionController.saveProgrammingCode);

// Submit programming answer
router.post('/programming/submit', SubmissionController.submitProgramming);

// Get programming submission history
router.get('/programming/:questionId/history', SubmissionController.getProgrammingHistory);

// =====================================================
// MCQ SUBMISSION ROUTES
// =====================================================

// Submit MCQ answer
router.post('/mcq/submit', SubmissionController.submitMCQ);

// Get MCQ submission history
router.get('/mcq/:questionId/history', SubmissionController.getMCQHistory);

// =====================================================
// PROGRESS ROUTES
// =====================================================

// Get course progress
router.get('/progress/course/:courseId', SubmissionController.getCourseProgress);

// Get segment progress
router.get('/progress/segment/:segmentId', SubmissionController.getSegmentProgress);

// Get practice segment progress
router.get('/progress/practice/:practiceSegmentId', SubmissionController.getPracticeProgress);

module.exports = router;

