const { HTTP_STATUS } = require('../config/constants');

/**
 * Send success response
 */
const success = (res, { data = null, message = 'Success', statusCode = HTTP_STATUS.OK, meta = null }) => {
  const response = {
    success: true,
    message,
    ...(data !== null && { data }),
    ...(meta !== null && { meta }),
    timestamp: new Date().toISOString()
  };
  return res.status(statusCode).json(response);
};

/**
 * Send created response (201)
 */
const created = (res, { data = null, message = 'Created successfully' }) => {
  return success(res, { data, message, statusCode: HTTP_STATUS.CREATED });
};

/**
 * Send error response
 */
const error = (res, { message = 'An error occurred', statusCode = HTTP_STATUS.SERVER_ERROR, errorCode = null, errors = null }) => {
  const response = {
    success: false,
    message,
    ...(errorCode && { errorCode }),
    ...(errors && { errors }),
    timestamp: new Date().toISOString()
  };
  return res.status(statusCode).json(response);
};

/**
 * Send bad request response (400)
 */
const badRequest = (res, { message = 'Bad request', errorCode = null, errors = null }) => {
  return error(res, { message, statusCode: HTTP_STATUS.BAD_REQUEST, errorCode, errors });
};

/**
 * Send unauthorized response (401)
 */
const unauthorized = (res, { message = 'Unauthorized', errorCode = null }) => {
  return error(res, { message, statusCode: HTTP_STATUS.UNAUTHORIZED, errorCode });
};

/**
 * Send forbidden response (403)
 */
const forbidden = (res, { message = 'Forbidden', errorCode = null }) => {
  return error(res, { message, statusCode: HTTP_STATUS.FORBIDDEN, errorCode });
};

/**
 * Send not found response (404)
 */
const notFound = (res, { message = 'Not found', errorCode = null }) => {
  return error(res, { message, statusCode: HTTP_STATUS.NOT_FOUND, errorCode });
};

/**
 * Send conflict response (409)
 */
const conflict = (res, { message = 'Resource already exists', errorCode = null }) => {
  return error(res, { message, statusCode: HTTP_STATUS.CONFLICT, errorCode });
};

/**
 * Send validation error response (422)
 */
const validationError = (res, { message = 'Validation failed', errors = [] }) => {
  return error(res, { message, statusCode: HTTP_STATUS.UNPROCESSABLE, errors });
};

/**
 * Send paginated response
 */
const paginated = (res, { data, page, limit, total, message = 'Success' }) => {
  const totalPages = Math.ceil(total / limit);
  return success(res, {
    data,
    message,
    meta: {
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  });
};

module.exports = {
  success,
  created,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  paginated
};