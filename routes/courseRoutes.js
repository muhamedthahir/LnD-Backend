const express = require('express');
const router = express.Router();
const CourseController = require('../controllers/courseController');
const { authenticate, authorize } = require('../middleware/auth');

// Public routes (for students to view courses)
router.get('/', authenticate, CourseController.getAll);
router.get('/my-courses', authenticate, CourseController.getMyCourses);
router.get('/:id', authenticate, CourseController.getById);
router.post('/enroll', authenticate, CourseController.enroll);

// Admin routes (college_admin, primary_admin, skillvantix_admin)
router.post('/', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), CourseController.create);
router.put('/:id', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), CourseController.update);
router.delete('/:id', authenticate, authorize('college_admin', 'primary_admin', 'skillvantix_admin'), CourseController.delete);

module.exports = router;

