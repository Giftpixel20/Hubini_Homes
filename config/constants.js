// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500
};

// Error Codes
const ERROR_CODES = {
  // Auth errors
  INVALID_CREDENTIALS: 'AUTH_001',
  TOKEN_EXPIRED: 'AUTH_002',
  TOKEN_INVALID: 'AUTH_003',
  USER_NOT_FOUND: 'AUTH_004',
  USER_NOT_VERIFIED: 'AUTH_005',
  USER_INACTIVE: 'AUTH_006',
  EMAIL_EXISTS: 'AUTH_007',
  USERNAME_EXISTS: 'AUTH_008',
  INVALID_RESET_TOKEN: 'AUTH_009',
  
  // Device errors
  DEVICE_NOT_FOUND: 'DEV_001',
  DEVICE_EXISTS: 'DEV_002',
  DEVICE_OFFLINE: 'DEV_003',
  DEVICE_COMMAND_FAILED: 'DEV_004',
  
  // Hub errors
  HUB_NOT_FOUND: 'HUB_001',
  HUB_EXISTS: 'HUB_002',
  HUB_OFFLINE: 'HUB_003',
  
  // General errors
  VALIDATION_ERROR: 'VAL_001',
  SERVER_ERROR: 'SRV_001',
  RATE_LIMIT: 'SRV_002'
};

// Success Messages
const SUCCESS_MESSAGES = {
  REGISTER: 'Registration successful. Please verify your email.',
  LOGIN: 'Login successful',
  LOGOUT: 'Logout successful',
  EMAIL_VERIFIED: 'Email verified successfully',
  PASSWORD_RESET_SENT: 'Password reset instructions sent',
  PASSWORD_RESET: 'Password reset successful',
  TOKEN_REFRESHED: 'Token refreshed successfully',
  DEVICE_CREATED: 'Device registered successfully',
  DEVICE_UPDATED: 'Device updated successfully',
  DEVICE_DELETED: 'Device deleted successfully',
  HUB_CREATED: 'Hub registered successfully',
  HUB_UPDATED: 'Hub updated successfully',
  HUB_DELETED: 'Hub deleted successfully'
};

module.exports = {
  HTTP_STATUS,
  ERROR_CODES,
  SUCCESS_MESSAGES
};