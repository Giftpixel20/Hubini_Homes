const express = require('express');
const router = express.Router();
const hubController = require('../controllers/hubController');
const { authenticate } = require('../middlewares/auth');
const {
  registerHubValidator,
  hubIdValidator
} = require('../middlewares/validators');

// All routes require authentication
router.use(authenticate);

// Hub CRUD
router.post('/', registerHubValidator, hubController.registerHub);
router.get('/', hubController.getHubs);
router.get('/:hubId', hubIdValidator, hubController.getHub);
router.put('/:hubId', hubIdValidator, hubController.updateHub);
router.delete('/:hubId', hubIdValidator, hubController.deleteHub);

// Hub device management
router.get('/:hubId/devices', hubIdValidator, hubController.getHubDevices);
router.post('/:hubId/devices/:deviceId', hubController.linkDevice);
router.delete('/devices/:deviceId', hubController.unlinkDevice);

module.exports = router;