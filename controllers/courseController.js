const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');

class CourseController {
  static async create(req, res) {
    try {
      const { 
        name, 
        category, 
        competency_level, 
        short_description, 
        course_outcomes, 
        status,
        thumbnail
      } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Course name is required' });
      }

      const courseId = await Course.create({
        name,
        category,
        competency_level,
        short_description,
        course_outcomes,
        status: status || 'draft',
        thumbnail,
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
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.pageSize, 10) || 10;
      const search = req.query.search || '';
      const category = req.query.category || '';
      const status = req.query.status || '';
      
      // Ensure valid values
      const validPage = page > 0 ? page : 1;
      const validPageSize = pageSize > 0 ? pageSize : 10;
      
      const limit = validPageSize;
      const offset = (validPage - 1) * validPageSize;
      
      const courses = await Course.getAll(limit, offset, { search, category, status });
      const totalCount = await Course.getCount({ search, category, status });
      
      res.json({
        courses,
        totalCount,
        page: validPage,
        pageSize: validPageSize,
        totalPages: Math.ceil(totalCount / validPageSize)
      });
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
      const { 
        name, 
        category, 
        competency_level, 
        short_description, 
        course_outcomes, 
        status,
        thumbnail
      } = req.body;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      await Course.update(id, { 
        name, 
        category, 
        competency_level, 
        short_description, 
        course_outcomes, 
        status,
        thumbnail
      });
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

