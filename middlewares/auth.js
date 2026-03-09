const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const response = require('../utils/response');
const { ERROR_CODES } = require('../config/constants');

/**
 * Verify JWT token and attach user to request
 */







const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response.unauthorized(res, {
        message: 'Access token required',
        errorCode: ERROR_CODES.TOKEN_INVALID
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const users = await query(
      'SELECT id, email, username, is_verified, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return response.unauthorized(res, {
        message: 'User not found',
        errorCode: ERROR_CODES.USER_NOT_FOUND
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return response.forbidden(res, {
        message: 'Account has been deactivated',
        errorCode: ERROR_CODES.USER_INACTIVE
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      isVerified: Boolean(user.is_verified)
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return response.unauthorized(res, {
        message: 'Token expired',
        errorCode: ERROR_CODES.TOKEN_EXPIRED
      });
    }

    return response.unauthorized(res, {
      message: 'Invalid token',
      errorCode: ERROR_CODES.TOKEN_INVALID
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const users = await query(
      'SELECT id, email, username, is_verified, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length > 0 && users[0].is_active) {
      req.user = {
        id: users[0].id,
        email: users[0].email,
        username: users[0].username,
        isVerified: Boolean(users[0].is_verified)
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

/**
 * Generate access token
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
};

module.exports = {
  authenticate,
  optionalAuth,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
};