const CourseAdministration = require('../models/CourseAdministration');
const Enrollment = require('../models/Enrollment');
const Group = require('../models/Group');
const User = require('../models/User');
const { generateTokens } = require('../utils/jwt');
const pool = require('../config/db');

class AdministrationController {
  /**
   * Create a new administration
   */
  static async create(req, res) {
    try {
      const {
        administrationName,
        displayId,
        category,
        competencyLevel,
        courseId,
        startTime,
        endTime,
        candidateType,
        groupCollege,
        groupDegree,
        groupDepartment,
        groupYear,
        selectedGroups,
        individualCollege,
        individualUsers
      } = req.body;

      const currentUser = req.user;
      const userId = currentUser?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate required fields
      if (!administrationName || !category || !competencyLevel || !courseId || !startTime || !endTime) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Handle enrollments (page 2 data)
      let invitesSent = false;
      let collegeName = candidateType === 'group' ? groupCollege : individualCollege;
      
      // college_admin can only create administrations for their institution
      if (currentUser.role === 'college_admin') {
        collegeName = currentUser.college_name;
      }

      // Create administration - will be published when invites are sent
      const adminId = await CourseAdministration.create({
        displayId: displayId || `ADMIN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        administrationName,
        category,
        competencyLevel,
        courseId,
        startDate: new Date(startTime),
        endDate: new Date(endTime),
        status: 'draft', // Will be updated to published after invites are sent
        createdBy: userId,
        college: collegeName || null
      });
      
      // Update users' college_name to match the selected college when enrollments are created
      // This ensures the college name is correctly reflected in the administration table
      if (collegeName && collegeName.trim() !== '') {
        if (candidateType === 'group' && selectedGroups && selectedGroups.length > 0) {
          // Get all users from selected groups and update their college_name
          for (const groupId of selectedGroups) {
            const members = await Group.getMembers(groupId);
            if (members && members.length > 0) {
              for (const member of members) {
                // Update user's college_name to match the selected college
                await User.update(member.id, { college_name: collegeName });
              }
            }
          }
        } else if (candidateType === 'individual' && individualUsers && individualUsers.length > 0) {
          // Update individual users' college_name to match the selected college
          for (const user of individualUsers) {
            await User.update(user.id, { college_name: collegeName });
          }
        }
      }
      
      if (candidateType === 'group' && selectedGroups && selectedGroups.length > 0) {
        // Save selected groups for this administration
        await CourseAdministration.saveSelectedGroups(adminId, selectedGroups);
        
        // Get all users from selected groups
        for (const groupId of selectedGroups) {
          const members = await Group.getMembers(groupId);
          if (members && members.length > 0) {
            for (const member of members) {
              // Check if user is already enrolled in this course through any administration
              const existingEnrollment = await Enrollment.checkCourseEnrollment(member.id, courseId);
              if (!existingEnrollment) {
                // Only create enrollment if user is not already enrolled in this course
                await Enrollment.create({
                  user_id: member.id,
                  administration_id: adminId,
                  status: 'invited'
                });
                invitesSent = true;
              } else {
                // User is already enrolled in this course, skip creating duplicate
                console.log(`User ${member.id} is already enrolled in course ${courseId}, skipping duplicate enrollment`);
              }
            }
          }
        }
      } else if (candidateType === 'individual' && individualUsers && individualUsers.length > 0) {
        // Enroll individual users
        for (const user of individualUsers) {
          // Check if user is already enrolled in this course through any administration
          const existingEnrollment = await Enrollment.checkCourseEnrollment(user.id, courseId);
          if (!existingEnrollment) {
            // Only create enrollment if user is not already enrolled in this course
            await Enrollment.create({
              user_id: user.id,
              administration_id: adminId,
              status: 'invited'
            });
            invitesSent = true;
          } else {
            // User is already enrolled in this course, skip creating duplicate
            console.log(`User ${user.id} is already enrolled in course ${courseId}, skipping duplicate enrollment`);
          }
        }
      }

      // Update status to published if invites were sent
      if (invitesSent) {
        await CourseAdministration.updateStatus(adminId, 'published');
      }

      const administration = await CourseAdministration.findById(adminId);

      res.status(201).json({
        message: 'Administration created successfully',
        administration
      });
    } catch (error) {
      console.error('Create administration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get all administrations with filters and pagination
   */
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        administrationName,
        status = 'all',
        college
      } = req.query;
      const currentUser = req.user;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // college_admin can only see administrations from their institution
      let collegeFilter = college;
      if (currentUser.role === 'college_admin') {
        collegeFilter = currentUser.college_name;
      }

      const result = await CourseAdministration.getAll({
        limit: parseInt(limit),
        offset,
        filters: {
          administrationName,
          status,
          college: collegeFilter
        }
      });

      res.json({
        administrations: result.administrations,
        total: result.total,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (error) {
      console.error('Get administrations error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get administration by ID
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;
      const administration = await CourseAdministration.findById(id);

      if (!administration) {
        return res.status(404).json({ error: 'Administration not found' });
      }

      // college_admin can only view administrations from their institution
      if (currentUser.role === 'college_admin' && administration.college !== currentUser.college_name) {
        return res.status(403).json({ error: 'You can only view administrations from your institution' });
      }

      // Get selected groups for this administration
      const selectedGroups = await CourseAdministration.getSelectedGroups(id);

      res.json({ 
        administration,
        selectedGroups
      });
    } catch (error) {
      console.error('Get administration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update administration (name, dates, and optionally enrollments)
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;
      const {
        administrationName,
        startTime,
        endTime,
        candidateType,
        groupCollege,
        groupDegree,
        groupDepartment,
        groupYear,
        selectedGroups,
        individualCollege,
        individualUsers,
        courseId
      } = req.body;

      if (!administrationName || !startTime || !endTime) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if administration exists and belongs to user's institution
      const existingAdmin = await CourseAdministration.findById(id);
      if (!existingAdmin) {
        return res.status(404).json({ error: 'Administration not found' });
      }

      // college_admin can only update administrations from their institution
      if (currentUser.role === 'college_admin' && existingAdmin.college !== currentUser.college_name) {
        return res.status(403).json({ error: 'You can only update administrations from your institution' });
      }

      const success = await CourseAdministration.update(id, {
        administrationName,
        startDate: new Date(startTime),
        endDate: new Date(endTime)
      });

      if (!success) {
        return res.status(404).json({ error: 'Administration not found' });
      }

      // Handle enrollments if provided (from page 2)
      let invitesSent = false;
      let collegeName = candidateType === 'group' ? groupCollege : individualCollege;
      
      // college_admin can only use their institution
      if (currentUser.role === 'college_admin') {
        collegeName = currentUser.college_name;
      }
      
      // Update users' college_name to match the selected college when enrollments are created
      // This ensures the college name is correctly reflected in the administration table
      if (collegeName && collegeName.trim() !== '') {
        if (candidateType === 'group' && selectedGroups && selectedGroups.length > 0) {
          // Get all users from selected groups and update their college_name
          for (const groupId of selectedGroups) {
            const members = await Group.getMembers(groupId);
            if (members && members.length > 0) {
              for (const member of members) {
                // Update user's college_name to match the selected college
                await User.update(member.id, { college_name: collegeName });
              }
            }
          }
        } else if (candidateType === 'individual' && individualUsers && individualUsers.length > 0) {
          // Update individual users' college_name to match the selected college
          for (const user of individualUsers) {
            await User.update(user.id, { college_name: collegeName });
          }
        }
      }
      
      if (candidateType === 'group' && selectedGroups && selectedGroups.length > 0) {
        // Save selected groups for this administration
        await CourseAdministration.saveSelectedGroups(id, selectedGroups);
        
        // Get all users from selected groups
        for (const groupId of selectedGroups) {
          const members = await Group.getMembers(groupId);
          if (members && members.length > 0) {
            for (const member of members) {
              // Check if user is already enrolled in this course through any administration
              const existingEnrollment = await Enrollment.checkCourseEnrollment(member.id, courseId);
              if (!existingEnrollment) {
                // Only create enrollment if user is not already enrolled in this course
                await Enrollment.create({
                  user_id: member.id,
                  administration_id: id,
                  status: 'invited'
                });
                invitesSent = true;
              } else {
                // User is already enrolled in this course, skip creating duplicate
                console.log(`User ${member.id} is already enrolled in course ${courseId}, skipping duplicate enrollment`);
              }
            }
          }
        }
      } else if (candidateType === 'individual' && individualUsers && individualUsers.length > 0) {
        // Enroll individual users
        for (const user of individualUsers) {
          // Check if user is already enrolled in this course through any administration
          const existingEnrollment = await Enrollment.checkCourseEnrollment(user.id, courseId);
          if (!existingEnrollment) {
            // Only create enrollment if user is not already enrolled in this course
            await Enrollment.create({
              user_id: user.id,
              administration_id: id,
              status: 'invited'
            });
            invitesSent = true;
          } else {
            // User is already enrolled in this course, skip creating duplicate
            console.log(`User ${user.id} is already enrolled in course ${courseId}, skipping duplicate enrollment`);
          }
        }
      }

      // Update status to published if invites were sent
      if (invitesSent) {
        await CourseAdministration.updateStatus(id, 'published');
      }

      const administration = await CourseAdministration.findById(id);
      const savedGroups = await CourseAdministration.getSelectedGroups(id);

      res.json({
        message: 'Administration updated successfully',
        administration,
        selectedGroups: savedGroups
      });
    } catch (error) {
      console.error('Update administration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete administration
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Check if administration exists and belongs to user's institution
      const existingAdmin = await CourseAdministration.findById(id);
      if (!existingAdmin) {
        return res.status(404).json({ error: 'Administration not found' });
      }

      // college_admin can only delete administrations from their institution
      if (currentUser.role === 'college_admin' && existingAdmin.college !== currentUser.college_name) {
        return res.status(403).json({ error: 'You can only delete administrations from your institution' });
      }

      // Check if administration has any enrollments/invites
      if (existingAdmin.total_invites && existingAdmin.total_invites > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete administration with enrolled users. Remove all enrollments first or archive the administration.' 
        });
      }

      // Also delete any associated groups from administration_groups table
      await pool.execute('DELETE FROM administration_groups WHERE administration_id = ?', [id]);

      const success = await CourseAdministration.delete(id);

      if (!success) {
        return res.status(404).json({ error: 'Administration not found' });
      }

      res.json({
        message: 'Administration deleted successfully'
      });
    } catch (error) {
      console.error('Delete administration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get comprehensive progress report for a user in an administration
   */
  static async getUserProgressReport(req, res) {
    try {
      const { id, userId } = req.params;
      const currentUser = req.user;

      // Check if administration exists
      const administration = await CourseAdministration.findById(id);
      if (!administration) {
        return res.status(404).json({ error: 'Administration not found' });
      }

      // college_admin can only view progress from their institution
      if (currentUser.role === 'college_admin' && administration.college !== currentUser.college_name) {
        return res.status(403).json({ error: 'You can only view progress from your institution' });
      }

      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get course details
      const [courseRows] = await pool.execute(
        `SELECT c.* FROM courses c WHERE c.id = ?`,
        [administration.course_id]
      );
      const course = courseRows[0];

      // Get course progress from user_courses
      const [courseProgressRows] = await pool.execute(
        `SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?`,
        [userId, administration.course_id]
      );
      const courseProgress = courseProgressRows[0] || {
        status: 'not_started',
        progress_percentage: 0,
        started_at: null,
        completed_at: null,
        last_accessed_at: null
      };

      // Get topics for this course
      const [topics] = await pool.execute(
        `SELECT t.*, 
          (SELECT COUNT(*) FROM segments WHERE topic_id = t.id) as lesson_count,
          (SELECT COUNT(*) FROM practice_segments WHERE topic_id = t.id) as practice_count
         FROM topics t 
         WHERE t.course_id = ? 
         ORDER BY t.order_index, t.id`,
        [administration.course_id]
      );

      // Get topic progress for this user
      const [topicProgress] = await pool.execute(
        `SELECT * FROM user_topic_progress WHERE user_id = ? AND course_id = ?`,
        [userId, administration.course_id]
      );

      // Create a map of topic progress
      const topicProgressMap = {};
      topicProgress.forEach(tp => {
        topicProgressMap[tp.topic_id] = tp;
      });

      // Get all segments for all topics
      // First get lesson segments
      const [lessonSegments] = await pool.execute(
        `SELECT s.id, s.topic_id, s.name as title, s.description, s.order_index, 
                s.segment_type, s.created_at, s.updated_at, 'lesson' as type_category
         FROM segments s 
         JOIN topics t ON s.topic_id = t.id 
         WHERE t.course_id = ?
         ORDER BY s.topic_id, s.order_index`,
        [administration.course_id]
      );

      // Then get practice segments
      const [practiceSegments] = await pool.execute(
        `SELECT ps.id, ps.topic_id, ps.name as title, ps.description, 0 as order_index,
                'practice' as segment_type, ps.created_at, ps.updated_at, 'practice' as type_category
         FROM practice_segments ps 
         JOIN topics t ON ps.topic_id = t.id 
         WHERE t.course_id = ?
         ORDER BY ps.topic_id, ps.id`,
        [administration.course_id]
      );

      // Combine and sort segments
      const segments = [...lessonSegments, ...practiceSegments].sort((a, b) => {
        if (a.topic_id !== b.topic_id) return a.topic_id - b.topic_id;
        return a.order_index - b.order_index;
      });

      // Get segment progress for this user
      const [segmentProgress] = await pool.execute(
        `SELECT * FROM user_segment_progress WHERE user_id = ? AND course_id = ?`,
        [userId, administration.course_id]
      );

      // Create a map of segment progress
      const segmentProgressMap = {};
      segmentProgress.forEach(sp => {
        if (sp.segment_id) {
          segmentProgressMap[`segment_${sp.segment_id}`] = sp;
        } else if (sp.practice_segment_id) {
          segmentProgressMap[`practice_${sp.practice_segment_id}`] = sp;
        }
      });

      // Get MCQ submissions for practice segments
      const [mcqSubmissions] = await pool.execute(
        `SELECT ms.*, q.name as question_text, qt.name as question_type, ps.topic_id
         FROM mcq_submissions ms
         JOIN questions q ON ms.mcq_question_id = q.id
         JOIN question_types qt ON q.question_type_id = qt.id
         JOIN practice_segments ps ON ms.practice_segment_id = ps.id
         JOIN topics t ON ps.topic_id = t.id
         WHERE ms.user_id = ? AND t.course_id = ?`,
        [userId, administration.course_id]
      );

      // Get programming submissions
      const [programmingSubmissions] = await pool.execute(
        `SELECT ps_sub.*, q.name as question_text, q.name as question_title, ps.topic_id, ps.id as practice_segment_id
         FROM programming_submissions ps_sub
         JOIN questions q ON ps_sub.programming_question_id = q.id
         JOIN practice_segments ps ON ps_sub.practice_segment_id = ps.id
         JOIN topics t ON ps.topic_id = t.id
         WHERE ps_sub.user_id = ? AND t.course_id = ?`,
        [userId, administration.course_id]
      );

      // Build the comprehensive response
      const topicsWithProgress = topics.map(topic => {
        const progress = topicProgressMap[topic.id] || {
          status: 'not_started',
          progress_percentage: 0,
          segments_completed: 0,
          segments_total: (topic.lesson_count || 0) + (topic.practice_count || 0),
          started_at: null,
          completed_at: null
        };

        // Get segments for this topic
        const topicSegments = segments
          .filter(s => s.topic_id === topic.id)
          .map(segment => {
            const isLesson = segment.type_category === 'lesson';
            const key = isLesson ? `segment_${segment.id}` : `practice_${segment.id}`;
            const segProgress = segmentProgressMap[key] || {
              status: 'not_started',
              progress_percentage: 0,
              score: 0,
              max_score: 0,
              items_completed: 0,
              items_total: 0,
              started_at: null,
              completed_at: null
            };

            // Get questions for this segment (if practice/assessment)
            let questions = [];
            if (!isLesson) {
              // MCQ questions
              const mcqForSegment = mcqSubmissions.filter(ms => ms.practice_segment_id === segment.id);
              questions = mcqForSegment.map(mcq => ({
                id: mcq.mcq_question_id,
                question_text: mcq.question_text,
                question_type: 'mcq',
                is_correct: mcq.is_correct,
                best_score: mcq.best_score,
                last_score: mcq.last_score,
                max_score: mcq.max_score,
                attempt_count: mcq.attempt_count,
                status: mcq.status,
                last_answered_at: mcq.last_answered_at
              }));

              // Programming questions
              const progForSegment = programmingSubmissions.filter(ps => ps.practice_segment_id === segment.id);
              progForSegment.forEach(prog => {
                questions.push({
                  id: prog.question_id,
                  question_text: prog.question_title || prog.question_text,
                  question_type: 'programming',
                  is_correct: prog.is_correct,
                  score: prog.score,
                  max_score: prog.max_score,
                  test_cases_passed: prog.test_cases_passed,
                  test_cases_total: prog.test_cases_total,
                  status: prog.status,
                  submitted_at: prog.submitted_at
                });
              });
            }

            return {
              ...segment,
              progress: segProgress,
              questions
            };
          });

        return {
          ...topic,
          progress,
          segments: topicSegments
        };
      });

      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          college_name: user.college_name,
          department: user.department,
          roll_number: user.roll_number
        },
        course: {
          id: course?.id,
          name: course?.name,
          description: course?.short_description || course?.description,
          category: course?.category,
          competency_level: course?.competency_level
        },
        administration: {
          id: administration.id,
          display_id: administration.display_id,
          name: administration.administration_name,
          start_date: administration.start_date,
          end_date: administration.end_date
        },
        courseProgress: {
          status: courseProgress.status,
          progress_percentage: courseProgress.progress_percentage || 0,
          started_at: courseProgress.started_at,
          completed_at: courseProgress.completed_at,
          last_accessed_at: courseProgress.last_accessed_at
        },
        topics: topicsWithProgress
      });
    } catch (error) {
      console.error('Get user progress report error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get enrolled users for an administration
   */
  static async getEnrolledUsers(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Check if administration exists
      const administration = await CourseAdministration.findById(id);
      if (!administration) {
        return res.status(404).json({ error: 'Administration not found' });
      }

      // college_admin can only view enrollments from their institution
      if (currentUser.role === 'college_admin' && administration.college !== currentUser.college_name) {
        return res.status(403).json({ error: 'You can only view enrollments from your institution' });
      }

      const enrolledUsers = await Enrollment.findByAdministrationId(id);

      res.json({
        enrolledUsers,
        total: enrolledUsers.length
      });
    } catch (error) {
      console.error('Get enrolled users error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Save as draft
   */
  static async saveAsDraft(req, res) {
    try {
      const {
        administrationName,
        displayId,
        category,
        competencyLevel,
        courseId,
        startTime,
        endTime,
        college
      } = req.body;

      const currentUser = req.user;
      const userId = currentUser?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!administrationName || !category || !competencyLevel || !courseId || !startTime || !endTime) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // college_admin can only create administrations for their institution
      let collegeName = college;
      if (currentUser.role === 'college_admin') {
        collegeName = currentUser.college_name;
      }

      const adminId = await CourseAdministration.create({
        displayId: displayId || `ADMIN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        administrationName,
        category,
        competencyLevel,
        courseId,
        startDate: new Date(startTime),
        endDate: new Date(endTime),
        status: 'draft',
        createdBy: userId,
        college: collegeName || null
      });

      const administration = await CourseAdministration.findById(adminId);

      res.status(201).json({
        message: 'Administration saved as draft',
        administration
      });
    } catch (error) {
      console.error('Save as draft error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = AdministrationController;

