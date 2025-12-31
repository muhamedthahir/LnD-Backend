const express = require('express');
const router = express.Router();
const QuestionBankController = require('../controllers/questionBankController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.get('/', authenticate, QuestionBankController.getQuestionBanks);
router.get('/:id', authenticate, QuestionBankController.getQuestionBank);
router.post('/', authenticate, authorize('primary_admin', 'college_admin'), QuestionBankController.createQuestionBank);
router.put('/:id', authenticate, authorize('primary_admin', 'college_admin'), QuestionBankController.updateQuestionBank);
router.delete('/:id', authenticate, authorize('primary_admin', 'college_admin'), QuestionBankController.deleteQuestionBank);

module.exports = router;

