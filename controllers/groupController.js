const Group = require('../models/Group');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const XLSX = require('xlsx');
const multer = require('multer');
const { generateOTP, getOTPExpiration } = require('../utils/otpGenerator');
const { sendOTPEmailWithTemplate } = require('../services/sesEmailService');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

class GroupController {
  static async getGroups(req, res) {
    try {
      const { college, name } = req.query;
      const currentUser = req.user;
      
      // college_admin can only see groups from their institution
      let collegeFilter = college || null;
      if (currentUser.role === 'college_admin') {
        collegeFilter = currentUser.college_name;
      }
      
      const groups = await Group.getAll(collegeFilter, null, null);
      
      // Filter by name if provided
      let filteredGroups = groups;
      if (name) {
        const nameLower = name.toLowerCase();
        filteredGroups = groups.filter(group => 
          group.name.toLowerCase().includes(nameLower)
        );
      }
      
      res.json({ groups: filteredGroups });
    } catch (error) {
      console.error('Get groups error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getGroup(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;
      const group = await Group.findById(id);
      
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // college_admin can only view groups from their institution
      if (currentUser.role === 'college_admin' && group.college_name !== currentUser.college_name) {
        return res.status(403).json({ error: 'You can only view groups from your institution' });
      }

      const members = await Group.getMembers(id);
      res.json({ group, members });
    } catch (error) {
      console.error('Get group error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createGroup(req, res) {
    try {
      const { name, college_name, degree, department, passout_year } = req.body;
      const currentUser = req.user;
      const created_by = currentUser.id;

      // college_admin can only create groups in their own institution
      let finalCollegeName = college_name;
      if (currentUser.role === 'college_admin') {
        finalCollegeName = currentUser.college_name;
      }

      if (!name || !finalCollegeName) {
        return res.status(400).json({ error: 'Name and college name are required' });
      }

      const groupId = await Group.create({
        name,
        college_name: finalCollegeName,
        degree: degree || null,
        department: department || null,
        passout_year: passout_year || null,
        created_by
      });

      const group = await Group.findById(groupId);
      res.status(201).json({
        message: 'Group created successfully',
        group
      });
    } catch (error) {
      console.error('Create group error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateGroup(req, res) {
    try {
      const { id } = req.params;
      const { name, college_name, degree, department, passout_year } = req.body;
      const currentUser = req.user;

      // Get the group being updated
      const existingGroup = await Group.findById(id);
      if (!existingGroup) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // college_admin can only update groups from their institution
      if (currentUser.role === 'college_admin') {
        if (existingGroup.college_name !== currentUser.college_name) {
          return res.status(403).json({ error: 'You can only update groups from your institution' });
        }
        // Prevent changing college_name to another institution
        if (college_name && college_name !== currentUser.college_name) {
          return res.status(403).json({ error: 'You cannot move groups to another institution' });
        }
      }

      const finalCollegeName = currentUser.role === 'college_admin' ? currentUser.college_name : college_name;

      await Group.update(id, { name, college_name: finalCollegeName, degree, department, passout_year });
      const group = await Group.findById(id);

      res.json({
        message: 'Group updated successfully',
        group
      });
    } catch (error) {
      console.error('Update group error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deleteGroup(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Get the group being deleted
      const group = await Group.findById(id);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // college_admin can only delete groups from their institution
      if (currentUser.role === 'college_admin' && group.college_name !== currentUser.college_name) {
        return res.status(403).json({ error: 'You can only delete groups from your institution' });
      }

      await Group.delete(id);
      res.json({ message: 'Group deleted successfully' });
    } catch (error) {
      console.error('Delete group error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async downloadTemplate(req, res) {
    try {
      // Create Excel template
      const workbook = XLSX.utils.book_new();
      const worksheetData = [
        ['Name', 'Email', 'Roll Number']
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 25 }, // Name
        { wch: 30 }, // Email
        { wch: 15 }  // Roll Number
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
      
      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=student_template.xlsx');
      res.send(buffer);
    } catch (error) {
      console.error('Download template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async uploadStudents(req, res) {
    try {
      const { group_id, college_name, department, section } = req.body;
      const currentUser = req.user;
      
      if (!req.file) {
        return res.status(400).json({ error: 'Excel file is required' });
      }

      // college_admin can only upload to their institution
      let finalCollegeName = college_name;
      if (currentUser.role === 'college_admin') {
        finalCollegeName = currentUser.college_name;
      }

      if (!group_id || !finalCollegeName || !department) {
        return res.status(400).json({ error: 'Group ID, college name, and department are required' });
      }

      // Verify the group belongs to the user's institution
      const group = await Group.findById(group_id);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      if (currentUser.role === 'college_admin' && group.college_name !== currentUser.college_name) {
        return res.status(403).json({ error: 'You can only upload students to groups in your institution' });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const createdUsers = [];
      const errors = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const name = row['Name'] || row['name'];
        const email = row['Email'] || row['email'];
        const roll_number = row['Roll Number'] || row['roll_number'] || row['Roll Number'];

        if (!name || !email) {
          errors.push(`Row ${i + 2}: Missing name or email`);
          continue;
        }

        try {
          // Check if user exists
          let user = await User.findByEmail(email);
          
          if (!user) {
            // Generate OTP for new user
            const otp = generateOTP();
            const otpExpiresAt = getOTPExpiration();
            
            // Create new user without password (will be set via OTP)
            const userId = await User.create({
              name,
              email,
              password: null,
              role: 'student',
              college_name: finalCollegeName,
              roll_number,
              department,
              section: section || '1',
              otp,
              otp_expires_at: otpExpiresAt
            });
            user = await User.findById(userId);

            // Send OTP email using AWS SES and USER_INVITE template
            try {
              const emailResult = await sendOTPEmailWithTemplate(email, name, otp, req.user?.id);
              if (!emailResult.success) {
                console.error(`Failed to send OTP email to ${email}:`, emailResult.error);
              }
            } catch (emailError) {
              console.error(`Failed to send OTP email to ${email}:`, emailError);
            }
            
            // Also log OTP to console for development
            console.log(`\n[OTP GENERATED] User: ${name} (${email}) - OTP: ${otp}\n`);
          }

          // Add to group
          await Group.addMember(group_id, user.id);
          createdUsers.push(user);
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') {
            errors.push(`Row ${i + 2}: User with email ${email} already exists`);
          } else {
            errors.push(`Row ${i + 2}: ${error.message}`);
          }
        }
      }

      // After all users are added, automatically enroll them in courses linked to this group
      if (createdUsers.length > 0) {
        const Enrollment = require('../models/Enrollment');
        const pool = require('../config/db');
        
        // Find all published administrations where multiple members of this group are enrolled
        const [administrations] = await pool.execute(
          `SELECT ca.id, ca.course_id, ca.status, COUNT(DISTINCT e.student_id) as group_member_count
           FROM course_administrations ca
           INNER JOIN enrollments e ON e.administration_id = ca.id
           INNER JOIN group_members gm ON e.student_id = gm.user_id AND gm.group_id = ?
           WHERE ca.status = 'published'
           GROUP BY ca.id, ca.course_id, ca.status
           HAVING group_member_count >= 2`,
          [group_id]
        );

        // Enroll all new users in these administrations
        for (const user of createdUsers) {
          for (const admin of administrations) {
            const existingEnrollment = await Enrollment.checkCourseEnrollment(user.id, admin.course_id);
            if (!existingEnrollment) {
              await Enrollment.create({
                user_id: user.id,
                administration_id: admin.id,
                status: 'invited'
              });
              console.log(`Auto-enrolled user ${user.id} in administration ${admin.id} (course ${admin.course_id}) after bulk upload to group ${group_id}`);
            }
          }
        }
      }

      res.json({
        message: 'Students uploaded successfully',
        created: createdUsers.length,
        errors: errors.length > 0 ? errors : undefined,
        users: createdUsers
      });
    } catch (error) {
      console.error('Upload students error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getGroupEditData(req, res) {
    try {
      const { id } = req.params;
      const { search } = req.query;
      const currentUser = req.user;

      const group = await Group.findById(id);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // college_admin can only edit groups from their institution
      if (currentUser.role === 'college_admin' && group.college_name !== currentUser.college_name) {
        return res.status(403).json({ error: 'You can only edit groups from your institution' });
      }

      const members = await Group.getMembers(id);
      const availableUsers = await Group.getUsersNotInGroup(id, group.college_name, search || '');

      res.json({
        group,
        members,
        availableUsers
      });
    } catch (error) {
      console.error('Get group edit data error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateGroupMembers(req, res) {
    try {
      const { id } = req.params;
      const { addUserIds = [], removeUserIds = [] } = req.body;
      const currentUser = req.user;
      const Enrollment = require('../models/Enrollment');
      const pool = require('../config/db');

      // Verify the group belongs to the user's institution
      const group = await Group.findById(id);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      if (currentUser.role === 'college_admin' && group.college_name !== currentUser.college_name) {
        return res.status(403).json({ error: 'You can only modify groups from your institution' });
      }

      // Add new members to group
      if (addUserIds.length > 0) {
        await Group.addMembers(id, addUserIds);
        
        // Automatically enroll new members in courses linked to this group
        // Find all published administrations where multiple members of this group are enrolled
        // This indicates the group was selected for that administration
        const [administrations] = await pool.execute(
          `SELECT ca.id, ca.course_id, ca.status, COUNT(DISTINCT e.student_id) as group_member_count
           FROM course_administrations ca
           INNER JOIN enrollments e ON e.administration_id = ca.id
           INNER JOIN group_members gm ON e.student_id = gm.user_id AND gm.group_id = ?
           WHERE ca.status = 'published'
           GROUP BY ca.id, ca.course_id, ca.status
           HAVING group_member_count >= 2`,
          [id]
        );

        // For each administration, enroll the new users
        for (const admin of administrations) {
          for (const userId of addUserIds) {
            // Check if user is already enrolled in this course through any administration
            const existingEnrollment = await Enrollment.checkCourseEnrollment(userId, admin.course_id);
            if (!existingEnrollment) {
              // Create new enrollment
              await Enrollment.create({
                user_id: userId,
                administration_id: admin.id,
                status: 'invited'
              });
              console.log(`Auto-enrolled user ${userId} in administration ${admin.id} (course ${admin.course_id}) after adding to group ${id}`);
            }
          }
        }
      }

      // Remove members from group
      if (removeUserIds.length > 0) {
        // First, find all administrations linked to this group before removing members
        const [administrations] = await pool.execute(
          `SELECT DISTINCT ca.id, ca.course_id
           FROM course_administrations ca
           INNER JOIN enrollments e ON e.administration_id = ca.id
           INNER JOIN group_members gm ON e.student_id = gm.user_id AND gm.group_id = ?
           GROUP BY ca.id, ca.course_id
           HAVING COUNT(DISTINCT e.student_id) >= 2`,
          [id]
        );

        // Remove members from group
        await Group.removeMembers(id, removeUserIds);
        
        // Mark enrollments as expired for removed users
        // For each removed user, mark their enrollments from this group's administrations as expired
        for (const userId of removeUserIds) {
          for (const admin of administrations) {
            // Find enrollment for this user and administration
            const [enrollments] = await pool.execute(
              `SELECT id FROM enrollments 
               WHERE student_id = ? AND administration_id = ? 
               AND status != 'Expired'`,
              [userId, admin.id]
            );
            
            // Mark as expired
            for (const enrollment of enrollments) {
              await Enrollment.updateStatus(enrollment.id, 'Expired');
              console.log(`Marked enrollment ${enrollment.id} as expired for user ${userId} after removal from group ${id}`);
            }
          }
        }
      }

      const members = await Group.getMembers(id);
      res.json({
        message: 'Group members updated successfully',
        members
      });
    } catch (error) {
      console.error('Update group members error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = GroupController;
module.exports.upload = upload.single('file');

