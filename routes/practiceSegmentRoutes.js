const express = require('express');
const router = express.Router();
const PracticeSegmentController = require('../controllers/practiceSegmentController');
const { authenticate, authorize } = require('../middleware/auth');

// Get practice segments by topic
router.get('/topic/:topic_id', authenticate, PracticeSegmentController.getByTopic);

// Get a single practice segment
router.get('/:id', authenticate, PracticeSegmentController.getById);

// Create a new practice segment (admin only)
router.post('/', authenticate, authorize('college_admin', 'primary_admin'), PracticeSegmentController.create);

// Update a practice segment (admin only)
router.put('/:id', authenticate, authorize('college_admin', 'primary_admin'), PracticeSegmentController.update);

// Delete a practice segment (admin only)
router.delete('/:id', authenticate, authorize('college_admin', 'primary_admin'), PracticeSegmentController.delete);

// Get available programming questions for practice segment (filtered by institution)
router.get('/:id/available-programming-questions', authenticate, PracticeSegmentController.getAvailableProgrammingQuestions);

// Get available MCQ questions for practice segment (filtered by institution)
router.get('/:id/available-mcq-questions', authenticate, PracticeSegmentController.getAvailableMcqQuestions);

// Get programming questions for a practice segment
router.get('/:id/programming-questions', authenticate, PracticeSegmentController.getProgrammingQuestions);

// Get MCQ questions for a practice segment
router.get('/:id/mcq-questions', authenticate, PracticeSegmentController.getMcqQuestions);

// Add programming question to practice segment (admin only)
router.post('/:id/programming-questions', authenticate, authorize('college_admin', 'primary_admin'), PracticeSegmentController.addProgrammingQuestion);

// Remove programming question from practice segment (admin only)
router.delete('/:id/programming-questions/:question_id', authenticate, authorize('college_admin', 'primary_admin'), PracticeSegmentController.removeProgrammingQuestion);

// Add MCQ question to practice segment (admin only)
router.post('/:id/mcq-questions', authenticate, authorize('college_admin', 'primary_admin'), PracticeSegmentController.addMcqQuestion);

// Remove MCQ question from practice segment (admin only)
router.delete('/:id/mcq-questions/:question_id', authenticate, authorize('college_admin', 'primary_admin'), PracticeSegmentController.removeMcqQuestion);

module.exports = router;

