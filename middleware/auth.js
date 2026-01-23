// JWT authentication middleware
const { verifyAccessToken, extractToken } = require('../utils/jwt');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const token = extractToken(req);
    
    if (!token) {
      // Ensure CORS headers are set before sending error response
      const origin = req.headers.origin;
      if (origin && (origin.includes('cloudfront.net') || origin.includes('localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided. Please log in to access this resource',
        isAuthenticated: false
      });
    }

    // Verify access token
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      // Ensure CORS headers are set before sending error response
      const origin = req.headers.origin;
      if (origin && (origin.includes('cloudfront.net') || origin.includes('localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token is invalid or expired. Please log in again',
        isAuthenticated: false
      });
    }

    // Fetch user from database to ensure user still exists
    const user = await User.findById(decoded.id);
    
    if (!user) {
      // Ensure CORS headers are set before sending error response
      const origin = req.headers.origin;
      if (origin && (origin.includes('cloudfront.net') || origin.includes('localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      return res.status(401).json({ 
        error: 'User not found',
        message: 'User associated with token no longer exists',
        isAuthenticated: false
      });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      college_name: user.college_name || null,
      roll_number: user.roll_number || null,
      department: user.department || null,
      section: user.section || null
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      // Ensure CORS headers are set before sending error response
      const origin = req.headers.origin;
      if (origin && (origin.includes('cloudfront.net') || origin.includes('localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      console.log('Authorization failed - user role:', req.user.role, 'not in allowed roles:', roles);
      // Ensure CORS headers are set before sending error response
      const origin = req.headers.origin;
      if (origin && (origin.includes('cloudfront.net') || origin.includes('localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Access denied. Required roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Middleware to enforce institution-based filtering for college_admin
 * For college_admin: automatically sets college filter to their institution
 * For primary_admin: allows access to all institutions
 */
const enforceInstitutionAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // college_admin can only access their own institution's data
  if (req.user.role === 'college_admin') {
    if (!req.user.college_name) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'College admin must be assigned to an institution'
      });
    }
    // Force the college filter to the user's institution
    req.institutionFilter = req.user.college_name;
    // Override any college query param to prevent bypassing
    req.query.college = req.user.college_name;
    req.query.college_name = req.user.college_name;
  } else if (req.user.role === 'primary_admin') {
    // primary_admin can access all institutions
    req.institutionFilter = null; // No filter - access all
  }

  next();
};

/**
 * Check if user can access a specific institution's data
 * @param {Object} user - The authenticated user
 * @param {string} collegeName - The college name to check access for
 * @returns {boolean} - True if user can access the institution's data
 */
const canAccessInstitution = (user, collegeName) => {
  if (!user) return false;
  if (user.role === 'primary_admin') return true;
  if (user.role === 'college_admin') {
    return user.college_name === collegeName;
  }
  return false;
};

/**
 * Get the institution filter for queries based on user role
 * @param {Object} user - The authenticated user
 * @returns {string|null} - College name to filter by, or null for all
 */
const getInstitutionFilter = (user) => {
  if (!user) return null;
  if (user.role === 'college_admin') {
    return user.college_name;
  }
  return null; // primary_admin sees all
};

module.exports = { 
  authenticate, 
  authorize, 
  enforceInstitutionAccess,
  canAccessInstitution,
  getInstitutionFilter
};

