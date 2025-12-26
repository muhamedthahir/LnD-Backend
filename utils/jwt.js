const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '-refresh';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m'; // 15 minutes default
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'; // 7 days default
const REMEMBER_ME_REFRESH_TOKEN_EXPIRES_IN = process.env.REMEMBER_ME_REFRESH_TOKEN_EXPIRES_IN || '30d'; // 30 days for remember me

/**
 * Generate an access token (short-lived)
 * @param {Object} user - User object with id, email, role, etc.
 * @returns {string} JWT access token
 */
function generateAccessToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
    // Include other necessary user data
    college_name: user.college_name || null,
    roll_number: user.roll_number || null,
    department: user.department || null,
    section: user.section || null
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    issuer: 'lnd-backend',
    audience: 'lnd-frontend'
  });
}

/**
 * Generate a refresh token (long-lived, stored in database)
 * @param {Object} user - User object with id
 * @param {boolean} rememberMe - Whether to use extended expiration
 * @returns {string} Refresh token (random string, not JWT)
 */
function generateRefreshToken(user, rememberMe = false) {
  // Generate a secure random token
  const token = crypto.randomBytes(64).toString('hex');
  return token;
}

/**
 * Get refresh token expiration date
 * @param {boolean} rememberMe - Whether to use extended expiration
 * @returns {Date} Expiration date
 */
function getRefreshTokenExpiration(rememberMe = false) {
  const expiresIn = rememberMe 
    ? REMEMBER_ME_REFRESH_TOKEN_EXPIRES_IN 
    : REFRESH_TOKEN_EXPIRES_IN;
  
  // Parse expiresIn (e.g., '7d', '30d')
  const match = expiresIn.match(/^(\d+)([dhms])$/);
  if (!match) {
    throw new Error('Invalid REFRESH_TOKEN_EXPIRES_IN format');
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  const expiration = new Date();
  switch (unit) {
    case 'd':
      expiration.setDate(expiration.getDate() + value);
      break;
    case 'h':
      expiration.setHours(expiration.getHours() + value);
      break;
    case 'm':
      expiration.setMinutes(expiration.getMinutes() + value);
      break;
    case 's':
      expiration.setSeconds(expiration.getSeconds() + value);
      break;
  }
  
  return expiration;
}

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @param {boolean} rememberMe - Whether to use extended expiration for refresh token
 * @returns {Object} { accessToken, refreshToken, refreshTokenExpiration }
 */
function generateTokens(user, rememberMe = false) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, rememberMe);
  const refreshTokenExpiration = getRefreshTokenExpiration(rememberMe);
  
  return {
    accessToken,
    refreshToken,
    refreshTokenExpiration
  };
}

/**
 * Verify and decode an access token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'lnd-backend',
      audience: 'lnd-frontend'
    });
    
    // Ensure it's an access token
    if (decoded.type !== 'access') {
      return null;
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('Access token expired');
    } else {
      console.error('JWT verification error:', error.message);
    }
    return null;
  }
}

/**
 * Verify and decode a refresh token (JWT-based, optional)
 * Currently refresh tokens are stored in DB, but this can verify if needed
 * @param {string} token - Refresh token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'lnd-backend',
      audience: 'lnd-frontend'
    });
  } catch (error) {
    console.error('Refresh token verification error:', error.message);
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param {Object} req - Express request object
 * @returns {string|null} Token or null if not found
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  return null;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  getRefreshTokenExpiration,
  verifyAccessToken,
  verifyRefreshToken,
  extractToken,
  // Legacy support
  generateToken: generateAccessToken,
  verifyToken: verifyAccessToken
};

