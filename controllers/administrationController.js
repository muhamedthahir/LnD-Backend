const CourseAdministration = require('../models/CourseAdministration');
const Enrollment = require('../models/Enrollment');
const Group = require('../models/Group');
const User = require('../models/User');
const { generateTokens } = require('../utils/jwt');

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

      res.json({ administration });
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

      res.json({
        message: 'Administration updated successfully',
        administration
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

