const Group = require('../models/Group');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const XLSX = require('xlsx');
const multer = require('multer');
const { generateOTP, getOTPExpiration } = require('../utils/otpGenerator');
// const { sendOTPEmail } = require('../utils/emailService'); // COMMENTED OUT FOR TESTING

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

class GroupController {
  static async getGroups(req, res) {
    try {
      const { college, name } = req.query;
      const groups = await Group.getAll(college || null, null, null);
      
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
      const group = await Group.findById(id);
      
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
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
      const created_by = req.user.id;

      if (!name || !college_name) {
        return res.status(400).json({ error: 'Name and college name are required' });
      }

      const groupId = await Group.create({
        name,
        college_name,
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

      await Group.update(id, { name, college_name, degree, department, passout_year });
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
      
      if (!req.file) {
        return res.status(400).json({ error: 'Excel file is required' });
      }

      if (!group_id || !college_name || !department) {
        return res.status(400).json({ error: 'Group ID, college name, and department are required' });
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
              college_name,
              roll_number,
              department,
              section: section || '1',
              otp,
              otp_expires_at: otpExpiresAt
            });
            user = await User.findById(userId);

            // Send OTP email - COMMENTED OUT FOR TESTING
            // try {
            //   await sendOTPEmail(email, name, otp);
            // } catch (emailError) {
            //   console.error(`Failed to send OTP email to ${email}:`, emailError);
            // }
            
            // Log OTP to console for testing
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

      const group = await Group.findById(id);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
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

      if (addUserIds.length > 0) {
        await Group.addMembers(id, addUserIds);
      }

      if (removeUserIds.length > 0) {
        await Group.removeMembers(id, removeUserIds);
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

