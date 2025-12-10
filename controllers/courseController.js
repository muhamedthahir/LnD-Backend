const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');

class CourseController {
  static async create(req, res) {
    try {
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Course name is required' });
      }

      const courseId = await Course.create({
        name,
        description: description || '',
        created_by: req.user.id
      });

      const course = await Course.findById(courseId);
      res.status(201).json({ message: 'Course created successfully', course });
    } catch (error) {
      console.error('Create course error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getAll(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      
      const courses = await Course.getAll(limit, offset);
      res.json(courses);
    } catch (error) {
      console.error('Get courses error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const course = await Course.getWithTopics(id);
      
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      res.json(course);
    } catch (error) {
      console.error('Get course error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      await Course.update(id, { name, description });
      const updatedCourse = await Course.findById(id);
      
      res.json({ message: 'Course updated successfully', course: updatedCourse });
    } catch (error) {
      console.error('Update course error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      
      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      await Course.delete(id);
      res.json({ message: 'Course deleted successfully' });
    } catch (error) {
      console.error('Delete course error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async enroll(req, res) {
    try {
      const { course_id } = req.body;
      const student_id = req.user.id;

      if (!course_id) {
        return res.status(400).json({ error: 'Course ID is required' });
      }

      // Check if already enrolled
      const existingEnrollment = await Enrollment.checkEnrollment(student_id, course_id);
      if (existingEnrollment) {
        return res.status(400).json({ error: 'Already enrolled in this course' });
      }

      await Enrollment.create({ student_id, course_id });
      res.status(201).json({ message: 'Enrolled in course successfully' });
    } catch (error) {
      console.error('Enroll error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getMyCourses(req, res) {
    try {
      const student_id = req.user.id;
      const enrollments = await Enrollment.findByStudentId(student_id);
      res.json(enrollments);
    } catch (error) {
      console.error('Get my courses error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = CourseController;

