const Enrollment = require('../models/Enrollment');

class EnrollmentController {
  static async getUserEnrollments(req, res) {
    try {
      const userId = req.user.id;
      const status = req.query.status || null;
      
      const enrollments = await Enrollment.findByStudentId(userId, status);
      
      res.json({
        enrollments
      });
    } catch (error) {
      console.error('Get enrollments error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createEnrollment(req, res) {
    try {
      const { student_id, course_id, status } = req.body;
      
      if (!student_id || !course_id) {
        return res.status(400).json({ error: 'Student ID and Course ID are required' });
      }

      const enrollmentId = await Enrollment.create({
        student_id,
        course_id,
        status: status || 'invited'
      });

      res.status(201).json({
        message: 'Enrollment created successfully',
        enrollment_id: enrollmentId
      });
    } catch (error) {
      console.error('Create enrollment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const validStatuses = ['invited', 'inProgress', 'completed', 'Expired'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      await Enrollment.updateStatus(id, status);

      res.json({
        message: 'Status updated successfully'
      });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = EnrollmentController;

