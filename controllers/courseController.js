const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const pool = require('../config/db');

class CourseController {
  // Helper to get creator's college name for a course
  static async getCourseCreatorCollege(courseId) {
    const [rows] = await pool.execute(
      'SELECT u.college_name FROM courses c JOIN users u ON c.created_by = u.id WHERE c.id = ?',
      [courseId]
    );
    return rows[0] ? rows[0].college_name : null;
  }

  static async create(req, res) {
    try {
      const { 
        name, 
        category, 
        competency_level, 
        short_description, 
        course_outcomes, 
        status,
        thumbnail,
        has_to_go_by_section
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
        has_to_go_by_section: has_to_go_by_section || false,
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
      const currentUser = req.user;
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
      
      // Build filters
      const filters = { search, category, status };
      
      // college_admin can only see courses from their institution; primary_admin sees all
      if (currentUser.role === 'college_admin') {
        filters.college_name = currentUser.college_name;
      }
      
      const courses = await Course.getAll(limit, offset, filters);
      const totalCount = await Course.getCount(filters);
      
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
      const currentUser = req.user;
      const course = await Course.getWithTopics(id);
      
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      // college_admin can only view courses from their institution; primary_admin can view all
      if (currentUser.role === 'college_admin') {
        const creatorCollege = await CourseController.getCourseCreatorCollege(id);
        if (creatorCollege !== currentUser.college_name) {
          return res.status(403).json({ error: 'You can only view courses from your institution' });
        }
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
      const currentUser = req.user;
      const { 
        name, 
        category, 
        competency_level, 
        short_description, 
        course_outcomes, 
        status,
        thumbnail,
        has_to_go_by_section
      } = req.body;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      // college_admin can only update courses from their institution
      if (currentUser.role === 'college_admin') {
        const creatorCollege = await CourseController.getCourseCreatorCollege(id);
        if (creatorCollege !== currentUser.college_name) {
          return res.status(403).json({ error: 'You can only update courses from your institution' });
        }
      }

      await Course.update(id, { 
        name, 
        category, 
        competency_level, 
        short_description, 
        course_outcomes, 
        status,
        thumbnail,
        has_to_go_by_section
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
      const currentUser = req.user;
      
      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      // college_admin can only delete courses from their institution; primary_admin can delete any
      if (currentUser.role === 'college_admin') {
        const creatorCollege = await CourseController.getCourseCreatorCollege(id);
        if (creatorCollege !== currentUser.college_name) {
          return res.status(403).json({ error: 'You can only delete courses from your institution' });
        }
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

