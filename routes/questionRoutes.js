const express = require('express');
const router = express.Router();
const QuestionController = require('../controllers/questionController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.get('/', authenticate, QuestionController.getQuestions);
router.get('/:id', authenticate, QuestionController.getQuestion);
router.get('/:id/programming-details', authenticate, QuestionController.getProgrammingDetails);
router.post('/', authenticate, authorize('primary_admin', 'college_admin'), QuestionController.createQuestion);
router.put('/:id', authenticate, authorize('primary_admin', 'college_admin'), QuestionController.updateQuestion);
router.delete('/:id', authenticate, authorize('primary_admin', 'college_admin'), QuestionController.deleteQuestion);

// Question bank association
router.post('/:id/add-to-bank', authenticate, authorize('primary_admin', 'college_admin'), QuestionController.addToQuestionBank);
router.post('/:id/remove-from-bank', authenticate, authorize('primary_admin', 'college_admin'), QuestionController.removeFromQuestionBank);

module.exports = router;




