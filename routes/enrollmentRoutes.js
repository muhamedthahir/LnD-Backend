const express = require('express');
const router = express.Router();
const EnrollmentController = require('../controllers/enrollmentController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, EnrollmentController.getUserEnrollments);
router.post('/', authenticate, EnrollmentController.createEnrollment);
router.put('/:id/status', authenticate, EnrollmentController.updateStatus);

module.exports = router;

