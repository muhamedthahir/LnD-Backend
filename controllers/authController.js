const User = require('../models/User');
const bcrypt = require('bcrypt');
const passport = require('passport');
const { generateOTP, getOTPExpiration } = require('../utils/otpGenerator');
const { sendOTPEmail } = require('../utils/emailService');

class AuthController {
  static async register(req, res) {
    try {
      const { name, email, password, role, college_name } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const userId = await User.create({
        name,
        email,
        password: hashedPassword,
        role: role || 'student',
        college_name: college_name || null
      });

      // Get created user
      const user = await User.findById(userId);

      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          college_name: user.college_name
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async login(req, res, next) {
    // Use Passport.js authentication
    passport.authenticate('local', async (err, user, info) => {
      if (err) {
        console.error('Passport authentication error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.message });
      }
      
      if (!user) {
        // Check if OTP was verified and password setup is required
        if (info?.requiresPasswordSetup) {
          return res.json({
            requiresPasswordSetup: true,
            userId: info.userId,
            message: 'OTP verified. Please set your password.'
          });
        }
        return res.status(401).json({ error: info?.message || 'Invalid credentials' });
      }

      // Log user in (create session)
      req.logIn(user, (err) => {
        if (err) {
          console.error('Login session error:', err);
          return res.status(500).json({ error: 'Internal server error', details: err.message });
        }

        // Save session explicitly
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
          }
          
          console.log('User logged in successfully. Session ID:', req.sessionID);
          console.log('Session passport:', req.session.passport);
          console.log('Is authenticated:', req.isAuthenticated());

          // Return user data
          return res.json({
            message: 'Login successful',
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              college_name: user.college_name || null,
              roll_number: user.roll_number || null,
              department: user.department || null,
              section: user.section || null
            }
          });
        });
      });
    })(req, res, next);
  }

  static async setPassword(req, res) {
    try {
      const { userId, otp, newPassword } = req.body;

      if (!userId || !otp || !newPassword) {
        return res.status(400).json({ error: 'User ID, OTP, and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Verify OTP
      const user = await User.findByOTP(otp);
      
      if (!user || user.id !== parseInt(userId)) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }

      // Hash and set password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await User.setPassword(userId, hashedPassword);

      res.json({
        message: 'Password set successfully. You can now login with your new password.'
      });
    } catch (error) {
      console.error('Set password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async logout(req, res) {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Error logging out' });
      }
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: 'Error destroying session' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logout successful' });
      });
    });
  }

  static async getProfile(req, res) {
    try {
      // User is available from Passport.js session
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return user without password
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        college_name: user.college_name || null,
        roll_number: user.roll_number || null,
        department: user.department || null,
        section: user.section || null,
        created_at: user.created_at
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async checkAuth(req, res) {
    // Check if user is authenticated via Passport
    console.log('CheckAuth - isAuthenticated:', req.isAuthenticated());
    console.log('CheckAuth - user:', req.user);
    console.log('CheckAuth - session:', req.session);
    
    if (req.isAuthenticated() && req.user) {
      return res.json({
        authenticated: true,
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          college_name: req.user.college_name || null,
          roll_number: req.user.roll_number || null,
          department: req.user.department || null,
          section: req.user.section || null
        }
      });
    } else {
      return res.json({ authenticated: false });
    }
  }
}

module.exports = AuthController;

