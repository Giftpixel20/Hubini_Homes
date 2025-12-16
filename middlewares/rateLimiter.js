const rateLimit = require('express-rate-limit');
const response = require('../utils/response');
const { getClientIP } = require('../utils/helpers');

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    return response.error(res, {
      message: 'Too many requests, please try again later',
      statusCode: 429
    });
  }
});

/**
 * Auth endpoints rate limiter (stricter)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    return response.error(res, {
      message: 'Too many authentication attempts, please try again later',
      statusCode: 429
    });
  }
});

/**
 * Password reset rate limiter
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyGenerator: (req) => req.body?.email || getClientIP(req),
  handler: (req, res) => {
    return response.error(res, {
      message: 'Too many password reset attempts, please try again later',
      statusCode: 429
    });
  }
});

/**
 * Device command rate limiter
 */
const deviceCommandLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  keyGenerator: (req) => `${req.user?.id || getClientIP(req)}_${req.params?.deviceId}`,
  handler: (req, res) => {
    return response.error(res, {
      message: 'Too many commands, please slow down',
      statusCode: 429
    });
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  deviceCommandLimiter
};