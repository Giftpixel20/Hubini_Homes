const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middlewares/auth');
const { updateProfileValidator } = require('../middlewares/validators');

// All routes require authentication
router.use(authenticate);

// Profile
router.get('/profile', userController.getProfile);
router.put('/profile', updateProfileValidator, userController.updateProfile);

// Stats & Activity
router.get('/stats', userController.getStats);
router.get('/activity', userController.getActivity);

// Account management
router.post('/deactivate', userController.deactivateAccount);
router.delete('/account', userController.deleteAccount);

module.exports = router;