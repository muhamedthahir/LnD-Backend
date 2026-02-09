const express = require('express');
const router = express.Router();
const UserDetailsController = require('../controllers/userDetailsController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get current user's details
router.get('/me', UserDetailsController.getMyDetails);

// Update current user's details
router.put('/me', UserDetailsController.updateMyDetails);

// Check profile completion status
router.get('/completion', UserDetailsController.checkCompletion);

// Admin routes - get any user's details
router.get('/user/:userId', authorize('primary_admin', 'college_admin'), UserDetailsController.getDetailsByUserId);

module.exports = router;

