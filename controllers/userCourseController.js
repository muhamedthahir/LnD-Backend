const UserCourse = require('../models/UserCourse');
const Enrollment = require('../models/Enrollment');

class UserCourseController {
  /**
   * Start a course for a user
   */
  static async startCourse(req, res) {
    try {
      const { courseId } = req.params;
      const userId = req.user.id;

      // Check if user is enrolled
      const enrollment = await Enrollment.checkCourseEnrollment(userId, parseInt(courseId));
      
      if (!enrollment) {
        return res.status(403).json({ error: 'You are not enrolled in this course' });
      }

      // Create or update user-course relationship
      const userCourseId = await UserCourse.createOrUpdate({
        user_id: userId,
        course_id: parseInt(courseId),
        enrollment_id: enrollment.id,
        status: 'in_progress',
        progress_percentage: 0,
        last_accessed_at: new Date()
      });

      // Update enrollment status if needed
      if (enrollment.status === 'invited') {
        await Enrollment.updateStatus(enrollment.id, 'in_progress');
      }

      res.json({ 
        success: true, 
        message: 'Course started successfully',
        user_course_id: userCourseId
      });
    } catch (error) {
      console.error('Error starting course:', error);
      res.status(500).json({ error: 'Failed to start course' });
    }
  }

  /**
   * Get progress for a course
   */
  static async getProgress(req, res) {
    try {
      const { courseId } = req.params;
      const userId = req.user.id;

      const progress = await UserCourse.getProgressDetails(userId, parseInt(courseId));
      
      if (!progress) {
        return res.json({
          status: 'not_started',
          progress_percentage: 0,
          completed_segments: []
        });
      }

      res.json(progress);
    } catch (error) {
      console.error('Error getting progress:', error);
      res.status(500).json({ error: 'Failed to get progress' });
    }
  }

  /**
   * Update progress
   */
  static async updateProgress(req, res) {
    try {
      const { courseId } = req.params;
      const { progress_percentage } = req.body;
      const userId = req.user.id;

      await UserCourse.updateProgress(userId, parseInt(courseId), progress_percentage);
      res.json({ success: true, message: 'Progress updated' });
    } catch (error) {
      console.error('Error updating progress:', error);
      res.status(500).json({ error: 'Failed to update progress' });
    }
  }

  /**
   * Mark segment as completed
   */
  static async markSegmentCompleted(req, res) {
    try {
      const { courseId, segmentId } = req.params;
      const userId = req.user.id;

      await UserCourse.markSegmentCompleted(userId, parseInt(courseId), parseInt(segmentId));
      const progress = await UserCourse.getProgressDetails(userId, parseInt(courseId));
      
      res.json({ 
        success: true, 
        message: 'Segment marked as completed',
        progress: progress.progress_percentage
      });
    } catch (error) {
      console.error('Error marking segment completed:', error);
      res.status(500).json({ error: 'Failed to mark segment as completed' });
    }
  }

  /**
   * Get all progress for current user
   */
  static async getMyProgress(req, res) {
    try {
      const userId = req.user.id;
      const courses = await UserCourse.findByUserId(userId);
      res.json(courses);
    } catch (error) {
      console.error('Error getting my progress:', error);
      res.status(500).json({ error: 'Failed to get progress' });
    }
  }
}

module.exports = UserCourseController;

