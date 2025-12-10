// Passport.js authentication middleware
const authenticate = (req, res, next) => {
  console.log('Auth check - isAuthenticated:', req.isAuthenticated());
  console.log('Auth check - user:', req.user);
  console.log('Auth check - session ID:', req.sessionID);
  console.log('Auth check - session passport:', req.session?.passport);
  
  if (req.isAuthenticated()) {
    return next();
  }
  
  // More detailed error message
  return res.status(401).json({ 
    error: 'Authentication required',
    message: 'Please log in to access this resource',
    isAuthenticated: false
  });
};

const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('Authorize check - user role:', req.user?.role);
    console.log('Authorize check - allowed roles:', roles);
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user || !roles.includes(req.user.role)) {
      console.log('Authorization failed - user role not in allowed roles');
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

module.exports = { authenticate, authorize };

