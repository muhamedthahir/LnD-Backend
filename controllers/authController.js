const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const bcrypt = require('bcrypt');
const { generateTokens, generateAccessToken, verifyAccessToken, extractToken } = require('../utils/jwt');
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

  static async login(req, res) {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find user by email
      let user;
      try {
        user = await User.findByEmail(email);
      } catch (error) {
        // Handle database connection errors
        if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
          console.error('Login error: Database connection issue:', error.message);
          return res.status(503).json({ error: 'Database connection error. Please try again.' });
        }
        console.error('Login error:', error);
        throw error;
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check if user is trying to login with OTP (only if OTP columns exist)
      if (user.otp !== undefined && !user.password && user.otp) {
        // User is logging in with OTP - check if OTP matches
        if (password === user.otp) {
          // OTP is correct, but password not set yet
          return res.json({
            requiresPasswordSetup: true,
            userId: user.id,
            message: 'OTP verified. Please set your password.'
          });
        } else {
          return res.status(401).json({ error: 'Invalid OTP' });
        }
      }

      // Check if password is set
      if (!user.password) {
        return res.status(401).json({ error: 'Please set your password first using the OTP sent to your email' });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate access and refresh tokens
      const { accessToken, refreshToken, refreshTokenExpiration } = generateTokens(user, rememberMe === true);

      // Store refresh token in database
      try {
        await RefreshToken.create({
          userId: user.id,
          token: refreshToken,
          expiresAt: refreshTokenExpiration
        });
      } catch (error) {
        console.error('Error storing refresh token:', error);
        // If table doesn't exist, create it and retry
        if (error.code === 'ER_NO_SUCH_TABLE') {
          await RefreshToken.createTable();
          await RefreshToken.create({
            userId: user.id,
            token: refreshToken,
            expiresAt: refreshTokenExpiration
          });
        } else {
          throw error;
        }
      }

      // Set cache-control headers to prevent 304 responses
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      console.log('User logged in successfully. User ID:', user.id, 'Remember Me:', rememberMe);

      // Return user data and tokens
      return res.json({
        message: 'Login successful',
        accessToken: accessToken,
        refreshToken: refreshToken,
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
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
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
    try {
      const { refreshToken: token } = req.body;
      
      // Revoke refresh token if provided
      if (token) {
        await RefreshToken.revoke(token);
      }
      
      // If user is authenticated, revoke all their refresh tokens
      if (req.user) {
        await RefreshToken.revokeAllForUser(req.user.id);
      }
      
      res.json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getProfile(req, res) {
    try {
      // User is available from JWT middleware
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

  static async refreshToken(req, res) {
    try {
      const { refreshToken: token } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      // Find refresh token in database
      let storedToken;
      try {
        storedToken = await RefreshToken.findByToken(token);
      } catch (error) {
        // Handle database connection errors
        if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
          console.error('Refresh token error: Database connection issue:', error.message);
          return res.status(503).json({ error: 'Database connection error. Please try again.' });
        }
        console.error('Refresh token error:', error);
        throw error;
      }
      
      if (!storedToken) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      // Get user associated with refresh token
      const user = await User.findById(storedToken.user_id);
      
      if (!user) {
        // User doesn't exist, revoke token
        await RefreshToken.revoke(token);
        return res.status(401).json({ error: 'User not found' });
      }

      // Generate new access token
      const accessToken = generateAccessToken(user);

      return res.json({
        accessToken: accessToken
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async checkAuth(req, res) {
    // Set cache-control headers to prevent 304 responses
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Extract and verify JWT token
    const token = extractToken(req);
    
    if (!token) {
      return res.json({ authenticated: false });
    }

    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return res.json({ authenticated: false });
    }

    // Verify user still exists in database
    try {
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.json({ authenticated: false });
      }

      return res.json({
        authenticated: true,
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
    } catch (error) {
      console.error('CheckAuth error:', error);
      return res.json({ authenticated: false });
    }
  }
}

module.exports = AuthController;

