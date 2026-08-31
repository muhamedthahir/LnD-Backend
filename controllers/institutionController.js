const Institution = require('../models/Institution');
const User = require('../models/User');
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { generateOTP, getOTPExpiration } = require('../utils/otpGenerator');
const { sendOTPEmailWithTemplate } = require('../services/sesEmailService');

class InstitutionController {
  static async getInstitutions(req, res) {
    try {
      const { search, limit = 10, offset = 0 } = req.query;
      
      const limitInt = Math.max(1, Math.min(1000, parseInt(limit, 10) || 10));
      const offsetInt = Math.max(0, parseInt(offset, 10) || 0);
      
      const result = await Institution.getAllPaginated({
        search: search || null,
        limit: limitInt,
        offset: offsetInt
      });

      res.json({
        institutions: result.institutions,
        total: result.total,
        limit: limitInt,
        offset: offsetInt
      });
    } catch (error) {
      console.error('Get institutions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getInstitution(req, res) {
    try {
      const { id } = req.params;
      const institution = await Institution.findById(id);
      
      if (!institution) {
        return res.status(404).json({ error: 'Institution not found' });
      }

      // Get admins for this institution
      const admins = await Institution.getAdmins(id);

      res.json({
        institution,
        admins
      });
    } catch (error) {
      console.error('Get institution error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createInstitution(req, res) {
    try {
      const {
        name,
        admin_name,
        admin_email,
        address,
        spoc_contact_number,
        alternate_contact,
        alternate_email,
        status
      } = req.body;

      if (!name || !admin_name || !admin_email) {
        return res.status(400).json({ error: 'Institution name, admin name, and admin email are required' });
      }

      if (alternate_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(alternate_email).trim())) {
        return res.status(400).json({ error: 'Invalid alternate email format' });
      }

      // Check if institution already exists
      const existingInstitution = await Institution.findByName(name);
      if (existingInstitution) {
        return res.status(400).json({ error: 'Institution with this name already exists' });
      }

      // Create institution
      const institutionId = await Institution.create({
        name,
        address,
        spoc_contact_number,
        alternate_contact,
        alternate_email,
        status
      });

      // Handle admin user
      let adminUser = await User.findByEmail(admin_email);
      
      if (adminUser) {
        // User exists - promote to college_admin if not already
        if (adminUser.role !== 'college_admin') {
          await User.update(adminUser.id, {
            role: 'college_admin',
            college_name: name
          });
        } else if (adminUser.college_name !== name) {
          // Update college name if different
          await User.update(adminUser.id, {
            college_name: name
          });
        }
      } else {
        // Create new admin user
        const otp = generateOTP();
        const otpExpiresAt = getOTPExpiration();

        const userId = await User.create({
          name: admin_name,
          email: admin_email,
          password: null,
          role: 'college_admin',
          college_name: name,
          otp,
          otp_expires_at: otpExpiresAt
        });

        // Send OTP email using AWS SES and USER_INVITE template
        try {
          const emailResult = await sendOTPEmailWithTemplate(admin_email, admin_name, otp, req.user?.id);
          if (!emailResult.success) {
            console.error(`Failed to send OTP email to ${admin_email}:`, emailResult.error);
          }
        } catch (emailError) {
          console.error(`Failed to send OTP email to ${admin_email}:`, emailError);
        }

        // Also log OTP to console for development
        console.log('\n========================================');
        console.log(`[OTP GENERATED] College Admin: ${admin_name} (${admin_email})`);
        console.log(`Institution: ${name}`);
        console.log(`OTP: ${otp}`);
        console.log(`Valid for 7 days`);
        console.log('========================================\n');
      }

      const institution = await Institution.findById(institutionId);
      const admins = await Institution.getAdmins(institutionId);

      res.status(201).json({
        message: 'Institution created successfully',
        institution,
        admins
      });
    } catch (error) {
      console.error('Create institution error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async updateInstitution(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        admin_name,
        admin_email,
        address,
        spoc_contact_number,
        alternate_contact,
        alternate_email,
        status
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Institution name is required' });
      }

      if (alternate_email && String(alternate_email).trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(alternate_email).trim())) {
        return res.status(400).json({ error: 'Invalid alternate email format' });
      }

      const institution = await Institution.findById(id);
      if (!institution) {
        return res.status(404).json({ error: 'Institution not found' });
      }

      // Update institution record (name + optional fields + status)
      await Institution.update(id, {
        name,
        address,
        spoc_contact_number,
        alternate_contact,
        alternate_email,
        status
      });

      // If admin details provided, update/create admin
      if (admin_name && admin_email) {
        let adminUser = await User.findByEmail(admin_email);
        
        if (adminUser) {
          // User exists - promote to college_admin if not already
          if (adminUser.role !== 'college_admin') {
            await User.update(adminUser.id, {
              role: 'college_admin',
              college_name: name
            });
          } else {
            // Update name and college if needed
            await User.update(adminUser.id, {
              name: admin_name,
              college_name: name
            });
          }
        } else {
          // Create new admin user
          const otp = generateOTP();
          const otpExpiresAt = getOTPExpiration();

          await User.create({
            name: admin_name,
            email: admin_email,
            password: null,
            role: 'college_admin',
            college_name: name,
            otp,
            otp_expires_at: otpExpiresAt
          });

          // Send OTP email using AWS SES and USER_INVITE template
          try {
            const emailResult = await sendOTPEmailWithTemplate(admin_email, admin_name, otp, req.user?.id);
            if (!emailResult.success) {
              console.error(`Failed to send OTP email to ${admin_email}:`, emailResult.error);
            }
          } catch (emailError) {
            console.error(`Failed to send OTP email to ${admin_email}:`, emailError);
          }

          // Also log OTP to console for development
          console.log('\n========================================');
          console.log(`[OTP GENERATED] College Admin: ${admin_name} (${admin_email})`);
          console.log(`Institution: ${name}`);
          console.log(`OTP: ${otp}`);
          console.log(`Valid for 7 days`);
          console.log('========================================\n');
        }
      }

      // Update all users with old college name to new name
      if (institution.name !== name) {
        await pool.execute(
          'UPDATE users SET college_name = ? WHERE college_name = ?',
          [name, institution.name]
        );
      }

      const updatedInstitution = await Institution.findById(id);
      const admins = await Institution.getAdmins(id);

      res.json({
        message: 'Institution updated successfully',
        institution: updatedInstitution,
        admins
      });
    } catch (error) {
      console.error('Update institution error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async deleteInstitution(req, res) {
    try {
      const { id } = req.params;
      
      await Institution.delete(id);
      
      res.json({ message: 'Institution deleted successfully' });
    } catch (error) {
      console.error('Delete institution error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async getAllInstitutions(req, res) {
    try {
      const institutions = await Institution.getAllActive();
      // Return full institution objects with id and name for dropdown usage (active only)
      res.json({
        institutions: institutions.map(i => ({
          id: i.id,
          name: i.name
        }))
      });
    } catch (error) {
      console.error('Get all institutions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = InstitutionController;

