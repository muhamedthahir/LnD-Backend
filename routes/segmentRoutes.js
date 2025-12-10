const express = require('express');
const router = express.Router();
const SegmentController = require('../controllers/segmentController');
const { authenticate, authorize } = require('../middleware/auth');

// Public routes (for students to view segments)
router.get('/topic/:topic_id', authenticate, SegmentController.getByTopic);
router.get('/:id', authenticate, SegmentController.getById);

// Admin routes
router.post('/', authenticate, authorize('college_admin', 'primary_admin'), SegmentController.create);
router.put('/:id', authenticate, authorize('college_admin', 'primary_admin'), SegmentController.update);
router.delete('/:id', authenticate, authorize('college_admin', 'primary_admin'), SegmentController.delete);

// Segment content management
router.post('/:segment_id/concepts', authenticate, authorize('college_admin', 'primary_admin'), SegmentController.addConcept);
router.post('/:segment_id/inclass-practice', authenticate, authorize('college_admin', 'primary_admin'), SegmentController.addInClassPractice);
router.post('/:segment_id/postclass-practice', authenticate, authorize('college_admin', 'primary_admin'), SegmentController.addPostClassPractice);

module.exports = router;

