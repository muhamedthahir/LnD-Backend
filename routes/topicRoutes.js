const express = require('express');
const router = express.Router();
const TopicController = require('../controllers/topicController');
const { authenticate, authorize } = require('../middleware/auth');

// Public routes (for students to view topics)
router.get('/course/:course_id', authenticate, TopicController.getByCourse);
router.get('/:id', authenticate, TopicController.getById);

// Admin routes
router.post('/', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), TopicController.create);
router.put('/:id', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), TopicController.update);
router.delete('/:id', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), TopicController.delete);

module.exports = router;

