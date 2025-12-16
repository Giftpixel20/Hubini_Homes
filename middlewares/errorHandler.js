const response = require('../utils/response');
const { ERROR_CODES } = require('../config/constants');

/**
 * Not found handler (404)
 */
const notFoundHandler = (req, res, next) => {
  return response.notFound(res, {
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);

  // Validation errors from express-validator
  if (err.array && typeof err.array === 'function') {
    return response.validationError(res, {
      message: 'Validation failed',
      errors: err.array().map(e => ({
        field: e.path || e.param,
        message: e.msg
      }))
    });
  }

  // JSON syntax error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return response.badRequest(res, {
      message: 'Invalid JSON in request body'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return response.unauthorized(res, {
      message: 'Invalid token',
      errorCode: ERROR_CODES.TOKEN_INVALID
    });
  }

  if (err.name === 'TokenExpiredError') {
    return response.unauthorized(res, {
      message: 'Token expired',
      errorCode: ERROR_CODES.TOKEN_EXPIRED
    });
  }

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return response.conflict(res, {
      message: 'Duplicate entry exists'
    });
  }

  // Custom application errors
  if (err.statusCode) {
    return response.error(res, {
      message: err.message,
      statusCode: err.statusCode,
      errorCode: err.errorCode
    });
  }

  // Default server error
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  return response.error(res, {
    message,
    errorCode: ERROR_CODES.SERVER_ERROR
  });
};

/**
 * Async handler wrapper - catches async errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  notFoundHandler,
  errorHandler,
  asyncHandler
};