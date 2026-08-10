const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const CourseAdministration = require('../models/CourseAdministration');

class DashboardController {
  static async getStudentDashboard(req, res) {
    try {
      const student_id = req.user.id;

      // Get enrolled courses
      const enrollments = await Enrollment.findByStudentId(student_id);
      
      // Get course count
      const courseCount = enrollments.length;

      // You can add more statistics here
      // For example: completed assessments, progress, etc.

      res.json({
        courses: enrollments,
        statistics: {
          total_courses: courseCount,
          // Add more stats as needed
        }
      });
    } catch (error) {
      console.error('Get dashboard error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getAdminDashboard(req, res) {
    try {
      // Get all courses
      const courses = await Course.getAll(100, 0);
      
      // You can add more admin statistics here
      // For example: total students, total courses, etc.

      res.json({
        courses,
        statistics: {
          total_courses: courses.length,
          // Add more stats as needed
        }
      });
    } catch (error) {
      console.error('Get admin dashboard error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getAdminStats(req, res) {
    try {
      const filters = {};
      if (req.user.role === 'college_admin' && req.user.college_name) {
        filters.college_name = req.user.college_name;
        filters.college = req.user.college_name;
      }

      const [courseStats, adminStats, recentAdministrations] = await Promise.all([
        Course.getStatusStats(filters),
        CourseAdministration.getStatusStats(filters),
        CourseAdministration.getRecentSummary(5, filters)
      ]);

      res.json({
        courseStats,
        adminStats,
        recentAdministrations
      });
    } catch (error) {
      console.error('Get admin stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = DashboardController;
