const userService = require('../services/userService');
const response = require('../utils/response');
const { asyncHandler } = require('../middlewares/errorHandler');
const { parsePagination } = require('../utils/helpers');

/**
 * Get Profile
 * GET /api/v1/users/profile
 */
const getProfile = asyncHandler(async (req, res) => {
  const profile = await userService.getProfile(req.user.id);

  return response.success(res, { data: profile });
});

/**
 * Update Profile
 * PUT /api/v1/users/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const profile = await userService.updateProfile(req.user.id, req.body);

  return response.success(res, {
    data: profile,
    message: 'Profile updated successfully'
  });
});

/**
 * Get User Stats
 * GET /api/v1/users/stats
 */
const getStats = asyncHandler(async (req, res) => {
  const stats = await userService.getUserStats(req.user.id);

  return response.success(res, { data: stats });
});

/**
 * Get Activity Log
 * GET /api/v1/users/activity
 */
const getActivity = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const result = await userService.getActivityLog(req.user.id, {
    page,
    limit,
    offset
  });

  return response.paginated(res, {
    data: result.logs,
    page: result.page,
    limit: result.limit,
    total: result.total
  });
});

/**
 * Deactivate Account
 * POST /api/v1/users/deactivate
 */
const deactivateAccount = asyncHandler(async (req, res) => {
  const result = await userService.deactivateAccount(req.user.id);

  return response.success(res, {
    data: result,
    message: 'Account deactivated successfully'
  });
});

/**
 * Delete Account
 * DELETE /api/v1/users/account
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const result = await userService.deleteAccount(req.user.id);

  return response.success(res, {
    data: result,
    message: 'Account deleted successfully'
  });
});

module.exports = {
  getProfile,
  updateProfile,
  getStats,
  getActivity,
  deactivateAccount,
  deleteAccount
};