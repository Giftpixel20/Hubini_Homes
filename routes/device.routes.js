const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { authenticate } = require('../middlewares/auth');
const { deviceCommandLimiter } = require('../middlewares/rateLimiter');
const {
  registerDeviceValidator,
  updateDeviceValidator,
  deviceIdValidator,
  deviceCommandValidator
} = require('../middlewares/validators');

// All routes require authentication
router.use(authenticate);

// Device CRUD
router.post('/', registerDeviceValidator, deviceController.registerDevice);
router.get('/', deviceController.getDevices);
router.get('/client', deviceController.getDevicesClient); // getDs format
router.get('/:deviceId', deviceIdValidator, deviceController.getDevice);
router.put('/:deviceId', updateDeviceValidator, deviceController.updateDevice);
router.delete('/:deviceId', deviceIdValidator, deviceController.deleteDevice);

// Device commands
router.post('/:deviceId/command', deviceCommandLimiter, deviceCommandValidator, deviceController.sendCommand);
router.post('/:deviceId/trigger', deviceCommandLimiter, deviceIdValidator, deviceController.triggerDevice);

module.exports = router;