const express = require('express');
const router = express.Router();
const multer = require('multer');
const QuestionController = require('../controllers/questionController');
const { authenticate, authorize } = require('../middleware/auth');

// Configure multer for memory storage
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

// Bulk upload for MCQ questions
router.get('/bulk-upload/mcq/template', authenticate, authorize('primary_admin', 'college_admin'), QuestionController.downloadBulkMcqTemplate);
router.post('/bulk-upload/mcq', authenticate, authorize('primary_admin', 'college_admin'), upload.single('file'), QuestionController.uploadBulkMcqQuestions);

// Bulk upload for Programming questions
router.get('/bulk-upload/programming/template', authenticate, authorize('primary_admin', 'college_admin'), QuestionController.downloadBulkProgrammingTemplate);
router.post('/bulk-upload/programming', authenticate, authorize('primary_admin', 'college_admin'), upload.single('file'), QuestionController.uploadBulkProgrammingQuestions);

module.exports = router;




