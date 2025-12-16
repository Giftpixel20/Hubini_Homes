const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const deviceRoutes = require('./device.routes');
const hubRoutes = require('./hub.routes');
const userRoutes = require('./user.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/devices', deviceRoutes);
router.use('/hubs', hubRoutes);
router.use('/users', userRoutes);

// API info
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Hubini IoT Platform API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      devices: '/api/v1/devices',
      hubs: '/api/v1/hubs',
      users: '/api/v1/users'
    }
  });
});

module.exports = router;