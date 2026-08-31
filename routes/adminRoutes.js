const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

// All admin routes require authentication and admin role
// Apply authenticate and authorize to each route individually for better error handling
router.get('/users', authenticate, authorize('primary_admin', 'college_admin'), AdminController.getUsers);
router.get('/users/:id', authenticate, authorize('primary_admin', 'college_admin'), AdminController.getUser);
router.get('/colleges', authenticate, authorize('primary_admin', 'college_admin'), AdminController.getColleges);
router.post('/users', authenticate, authorize('primary_admin', 'college_admin'), AdminController.createUser);
router.put('/users/:id', authenticate, authorize('primary_admin', 'college_admin'), AdminController.updateUser);
router.delete('/users/:id', authenticate, authorize('primary_admin', 'college_admin'), AdminController.deleteUser);
router.put('/users/:id/reset-password', authenticate, authorize('primary_admin', 'college_admin'), AdminController.resetPassword);
router.post('/users/:id/resend-otp', authenticate, authorize('primary_admin', 'college_admin'), AdminController.resendOTP);
router.get('/users/bulk/template', authenticate, authorize('primary_admin', 'college_admin'), AdminController.downloadBulkUserTemplate);
router.post('/users/bulk/upload', authenticate, authorize('primary_admin', 'college_admin'), AdminController.upload, AdminController.uploadBulkUsers);

module.exports = router;

