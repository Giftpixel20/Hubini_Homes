const express = require('express');
const router = express.Router();
const authController = require('../controllers/auths/authController');
const { authenticate } = require('../middlewares/auth');
const { authLimiter, passwordResetLimiter } = require('../middlewares/rateLimiter');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
  refreshTokenValidator
} = require('../middlewares/validators');

// Public routes
router.post('/register', authLimiter, registerValidator, authController.register);
router.post('/login', authLimiter, loginValidator, authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', passwordResetLimiter, forgotPasswordValidator, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidator, authController.resetPassword);
router.post('/refresh-token', refreshTokenValidator, authController.refreshToken);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);
router.post('/change-password', authenticate, changePasswordValidator, authController.changePassword);
router.get('/me', authenticate, authController.me);

module.exports = router;