const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/student', authenticate, authorize('student'), DashboardController.getStudentDashboard);
router.get('/admin', authenticate, authorize('college_admin', 'primary_admin'), DashboardController.getAdminDashboard);

module.exports = router;

