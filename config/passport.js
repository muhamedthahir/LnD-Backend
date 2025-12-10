const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');
const bcrypt = require('bcrypt');

// Local Strategy for username/password authentication
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      // Find user by email
      const user = await User.findByEmail(email);
      
      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      // Check if user is trying to login with OTP (only if OTP columns exist)
      if (user.otp !== undefined && !user.password && user.otp) {
        // User is logging in with OTP - check if OTP matches
        if (password === user.otp) {
          // OTP is correct, but password not set yet
          return done(null, false, { 
            message: 'OTP_VERIFIED',
            requiresPasswordSetup: true,
            userId: user.id
          });
        } else {
          return done(null, false, { message: 'Invalid OTP' });
        }
      }

      // Check if password is set
      if (!user.password) {
        return done(null, false, { message: 'Please set your password first using the OTP sent to your email' });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      // Return user without password
      const userWithoutPassword = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        college_name: user.college_name || null,
        roll_number: user.roll_number || null,
        department: user.department || null,
        section: user.section || null
      };

      return done(null, userWithoutPassword);
    } catch (error) {
      console.error('Passport local strategy error:', error);
      console.error('Error stack:', error.stack);
      return done(error);
    }
  }
));

// Serialize user for session
passport.serializeUser((user, done) => {
  console.log('Serializing user with ID:', user.id);
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    console.log('Deserializing user with ID:', id);
    const user = await User.findById(id);
    if (!user) {
      console.log('User not found for ID:', id);
      return done(null, false);
    }
    // Return user without password
    const userWithoutPassword = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      college_name: user.college_name || null,
      roll_number: user.roll_number || null,
      department: user.department || null,
      section: user.section || null
    };
    console.log('User deserialized successfully:', userWithoutPassword.email);
    done(null, userWithoutPassword);
  } catch (error) {
    console.error('Deserialize user error:', error);
    done(error);
  }
});

module.exports = passport;

