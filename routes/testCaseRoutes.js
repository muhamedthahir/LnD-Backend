const express = require('express');
const router = express.Router();
const TestCaseController = require('../controllers/testCaseController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.get('/programming-question/:programming_question_id', authenticate, TestCaseController.getTestCases);
router.get('/:id', authenticate, TestCaseController.getTestCase);
router.post('/', authenticate, authorize('primary_admin', 'college_admin', 'skillvantix_admin'), TestCaseController.createTestCase);
router.put('/:id', authenticate, authorize('primary_admin', 'college_admin', 'skillvantix_admin'), TestCaseController.updateTestCase);
router.delete('/:id', authenticate, authorize('primary_admin', 'college_admin', 'skillvantix_admin'), TestCaseController.deleteTestCase);

// Toggle actions
router.patch('/:id/toggle-active', authenticate, authorize('primary_admin', 'college_admin', 'skillvantix_admin'), TestCaseController.toggleActive);
router.patch('/:id/toggle-hidden', authenticate, authorize('primary_admin', 'college_admin', 'skillvantix_admin'), TestCaseController.toggleHidden);

module.exports = router;




