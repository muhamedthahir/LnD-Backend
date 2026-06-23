const express = require('express');
const router = express.Router();
const multer = require('multer');
const TestCaseController = require('../controllers/testCaseController');
const { authenticate, authorize } = require('../middleware/auth');

// Configure multer for memory storage (Excel uploads)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

// Bulk upload (define before '/:id' to avoid route conflicts)
router.get('/bulk-upload/template', authenticate, authorize('primary_admin', 'college_admin'), TestCaseController.downloadBulkTestCaseTemplate);
router.post('/bulk-upload/:programming_question_id', authenticate, authorize('primary_admin', 'college_admin'), upload.single('file'), TestCaseController.uploadBulkTestCases);

// All routes require authentication
router.get('/programming-question/:programming_question_id', authenticate, TestCaseController.getTestCases);
router.get('/:id', authenticate, TestCaseController.getTestCase);
router.post('/', authenticate, authorize('primary_admin', 'college_admin'), TestCaseController.createTestCase);
router.put('/:id', authenticate, authorize('primary_admin', 'college_admin'), TestCaseController.updateTestCase);
router.delete('/:id', authenticate, authorize('primary_admin', 'college_admin'), TestCaseController.deleteTestCase);

// Toggle actions
router.patch('/:id/toggle-active', authenticate, authorize('primary_admin', 'college_admin'), TestCaseController.toggleActive);
router.patch('/:id/toggle-hidden', authenticate, authorize('primary_admin', 'college_admin'), TestCaseController.toggleHidden);

module.exports = router;




