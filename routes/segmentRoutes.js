const express = require('express');
const router = express.Router();
const multer = require('multer');
const SegmentController = require('../controllers/segmentController');
const { authenticate, authorize } = require('../middleware/auth');

// Configure multer for memory storage (files will be uploaded to S3)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max for videos
    files: 10
  }
});

// Public routes (for students to view segments)
router.get('/topic/:topic_id', authenticate, SegmentController.getByTopic);
router.get('/:id', authenticate, SegmentController.getById);

// Admin routes - with file upload support
router.post('/', authenticate, authorize('college_admin', 'primary_admin'), upload.array('files', 10), SegmentController.create);
router.put('/:id', authenticate, authorize('college_admin', 'primary_admin'), upload.array('files', 10), SegmentController.update);
router.delete('/:id', authenticate, authorize('college_admin', 'primary_admin'), SegmentController.delete);

// Segment content management
router.post('/:segment_id/concepts', authenticate, authorize('college_admin', 'primary_admin'), SegmentController.addConcept);
router.post('/:segment_id/inclass-practice', authenticate, authorize('college_admin', 'primary_admin'), SegmentController.addInClassPractice);
router.post('/:segment_id/postclass-practice', authenticate, authorize('college_admin', 'primary_admin'), SegmentController.addPostClassPractice);

module.exports = router;

