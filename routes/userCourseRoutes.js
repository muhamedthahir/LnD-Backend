const express = require('express');
const router = express.Router();
const UserCourseController = require('../controllers/userCourseController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.post('/start/:courseId', authenticate, UserCourseController.startCourse);
router.get('/progress/:courseId', authenticate, UserCourseController.getProgress);
router.put('/progress/:courseId', authenticate, UserCourseController.updateProgress);
router.post('/complete-segment/:courseId/:segmentId', authenticate, UserCourseController.markSegmentCompleted);
router.get('/my-progress', authenticate, UserCourseController.getMyProgress);

module.exports = router;

