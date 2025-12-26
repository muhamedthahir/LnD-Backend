// JWT authentication middleware
const { verifyAccessToken, extractToken } = require('../utils/jwt');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided. Please log in to access this resource',
        isAuthenticated: false
      });
    }

    // Verify access token
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token is invalid or expired. Please log in again',
        isAuthenticated: false
      });
    }

    // Fetch user from database to ensure user still exists
    const user = await User.findById(decoded.id);
    
    if (!user) {
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
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      console.log('Authorization failed - user role:', req.user.role, 'not in allowed roles:', roles);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Access denied. Required roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };

