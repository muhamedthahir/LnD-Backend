const User = require('../models/User');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const XLSX = require('xlsx');
const multer = require('multer');
const { generateOTP, getOTPExpiration } = require('../utils/otpGenerator');
// const { sendOTPEmail } = require('../utils/emailService'); // COMMENTED OUT FOR TESTING

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

class AdminController {
  static async getUsers(req, res) {
    try {
      const { search, college, limit = 10, offset = 0 } = req.query;
      const currentUser = req.user; // Get current logged-in user
      
      // Parse limit and offset
      const limitInt = Math.max(1, Math.min(1000, parseInt(limit, 10) || 10));
      const offsetInt = Math.max(0, parseInt(offset, 10) || 0);
      
      // Debug logging
      console.log('GetUsers called with:', { search, college, limit: limitInt, offset: offsetInt });
      
      // Get total count and paginated users with filters applied at database level
      const result = await User.getAllPaginated({
        search: search || null,
        college: college || null,
        limit: limitInt,
        offset: offsetInt,
        excludePrimaryAdmin: true,
        excludeCurrentUser: currentUser ? currentUser.id : null
      });

      console.log('GetUsers result:', { userCount: result.users.length, total: result.total });

      res.json({ 
        users: result.users,
        total: result.total,
        limit: limitInt,
        offset: offsetInt
      });
    } catch (error) {
      console.error('Get users error:', error);
      console.error('Error details:', {
        code: error.code,
        errno: error.errno,
        sqlMessage: error.sqlMessage,
        sql: error.sql
      });
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  static async createUser(req, res) {
    try {
      const { name, email, password, role, college_name, roll_number, department, section, degree } = req.body;

      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }

      // Validate role
      const validRoles = ['student', 'college_admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Validate college name (required for all users)
      if (!college_name) {
        return res.status(400).json({ error: 'College name is required' });
      }

      // Validate student fields
      if (role === 'student') {
        if (!roll_number || !department) {
          return res.status(400).json({ error: 'Roll number and department are required for students' });
        }
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }

      // Generate OTP
      const otp = generateOTP();
      const otpExpiresAt = getOTPExpiration();

      // Create user without password (will be set via OTP)
      const userId = await User.create({
        name,
        email,
        password: null, // Password will be set after OTP verification
        role,
        college_name: college_name || null,
        roll_number: roll_number || null,
        department: department || null,
        section: section || '1',
        degree: degree || null,
        otp,
        otp_expires_at: otpExpiresAt
      });

      // Send OTP email - COMMENTED OUT FOR TESTING
      // try {
      //   await sendOTPEmail(email, name, otp);
      // } catch (emailError) {
      //   console.error('Failed to send OTP email:', emailError);
      // }
      
      // Log OTP to console for testing
      console.log('\n========================================');
      console.log(`[OTP GENERATED] User: ${name} (${email})`);
      console.log(`OTP: ${otp}`);
      console.log(`Valid for 7 days`);
      console.log(`========================================\n`);

      // Get created user
      const user = await User.findById(userId);

      res.status(201).json({
        message: 'User created successfully. OTP has been sent to email.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          college_name: user.college_name,
          roll_number: user.roll_number,
          department: user.department,
          section: user.section,
          degree: user.degree
        },
        otp: process.env.NODE_ENV === 'development' ? otp : undefined // Only show OTP in dev mode
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove password from update if present (should be separate endpoint)
      delete updateData.password;

      await User.update(id, updateData);
      const user = await User.findById(id);

      res.json({
        message: 'User updated successfully',
        user
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user; // Get current logged-in user
      const userId = parseInt(id, 10);

      // Prevent self-deletion
      if (currentUser && currentUser.id === userId) {
        return res.status(400).json({ error: 'You cannot delete your own account' });
      }

      // Get the user to be deleted
      const userToDelete = await User.findById(userId);
      if (!userToDelete) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent deleting primary_admin users
      if (userToDelete.role === 'primary_admin') {
        return res.status(403).json({ error: 'Primary admin accounts cannot be deleted through this interface' });
      }

      // Check if this is the last primary admin (safety check)
      if (userToDelete.role === 'primary_admin') {
        const allAdmins = await User.getByRole('primary_admin');
        if (allAdmins.length <= 1) {
          return res.status(400).json({ error: 'Cannot delete the last primary admin account' });
        }
      }

      // Check if this is a college_admin and if they're the last one for their institution
      if (userToDelete.role === 'college_admin' && userToDelete.college_name) {
        const collegeAdmins = await User.getCollegeAdminsByCollege(userToDelete.college_name);
        if (collegeAdmins.length <= 1) {
          return res.status(400).json({ 
            error: `Cannot delete the last college admin for "${userToDelete.college_name}". Each institution must have at least one college admin.` 
          });
        }
      }

      await User.delete(userId);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, id]
      );

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getColleges(req, res) {
    try {
      // Use institutions instead of getting from users
      const Institution = require('../models/Institution');
      const institutions = await Institution.getAll();
      const colleges = institutions.map(i => i.name);
      res.json({ colleges });
    } catch (error) {
      console.error('Get colleges error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async downloadBulkUserTemplate(req, res) {
    try {
      // Create Excel template with required columns
      const workbook = XLSX.utils.book_new();
      const worksheetData = [
        ['Name', 'Email', 'Roll Number', 'Department', 'Section', 'Degree']
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 25 }, // Name
        { wch: 30 }, // Email
        { wch: 15 }, // Roll Number
        { wch: 20 }, // Department
        { wch: 10 }, // Section
        { wch: 15 }  // Degree
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
      
      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=bulk_user_template.xlsx');
      res.send(buffer);
    } catch (error) {
      console.error('Download template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async uploadBulkUsers(req, res) {
    try {
      const { college_name } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ error: 'Excel file is required' });
      }

      if (!college_name) {
        return res.status(400).json({ error: 'College name is required' });
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
        const roll_number = row['Roll Number'] || row['roll_number'] || row['Roll Number'] || null;
        const department = row['Department'] || row['department'] || null;
        const section = row['Section'] || row['section'] || '1';
        const degree = row['Degree'] || row['degree'] || null;

        if (!name || !email) {
          errors.push(`Row ${i + 2}: Missing name or email`);
          continue;
        }

        try {
          // Check if user exists
          const existingUser = await User.findByEmail(email);
          
          if (existingUser) {
            errors.push(`Row ${i + 2}: User with email ${email} already exists`);
            continue;
          }

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
            degree: degree || null,
            otp,
            otp_expires_at: otpExpiresAt
          });
          
          const user = await User.findById(userId);

          // Send OTP email - COMMENTED OUT FOR TESTING
          // try {
          //   await sendOTPEmail(email, name, otp);
          // } catch (emailError) {
          //   console.error(`Failed to send OTP email to ${email}:`, emailError);
          // }
          
          // Log OTP to console for testing
          console.log(`\n[OTP GENERATED] User: ${name} (${email}) - OTP: ${otp}\n`);
          
          createdUsers.push({
            id: user.id,
            name: user.name,
            email: user.email,
            roll_number: user.roll_number,
            department: user.department,
            section: user.section
          });
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') {
            errors.push(`Row ${i + 2}: User with email ${email} already exists`);
          } else {
            errors.push(`Row ${i + 2}: ${error.message}`);
          }
        }
      }

      res.json({
        message: 'Users uploaded successfully',
        created: createdUsers.length,
        total: data.length,
        errors: errors.length > 0 ? errors : undefined,
        users: createdUsers
      });
    } catch (error) {
      console.error('Upload bulk users error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = AdminController;
module.exports.upload = upload.single('file');

