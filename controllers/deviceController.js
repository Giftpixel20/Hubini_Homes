const deviceService = require('../services/deviceService');
const response = require('../utils/response');
const { SUCCESS_MESSAGES, ERROR_CODES } = require('../config/constants');
const { asyncHandler } = require('../middlewares/errorHandler');
const { parsePagination } = require('../utils/helpers');

// WebSocket manager will be injected
let wsManager = null;
const setWsManager = (manager) => {
  wsManager = manager;
};

/**
 * Register Device
 * POST /api/v1/devices
 */
const registerDevice = asyncHandler(async (req, res) => {
  const { Local_ID, Name, Type, Model, trigs } = req.body;

  const result = await deviceService.registerDevice(req.user.id, {
    Local_ID,
    Name,
    Type,
    Model,
    trigs
  });

  return response.created(res, {
    data: result,
    message: SUCCESS_MESSAGES.DEVICE_CREATED
  });
});

/**
 * Get All Devices
 * GET /api/v1/devices
 */
const getDevices = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { type, search } = req.query;

  const result = await deviceService.getUserDevices(req.user.id, {
    page,
    limit,
    offset,
    type,
    search
  });

  return response.paginated(res, {
    data: result.devices,
    page: result.page,
    limit: result.limit,
    total: result.total
  });
});

/**
 * Get Devices for Client (getDs format)
 * GET /api/v1/devices/client
 */
const getDevicesClient = asyncHandler(async (req, res) => {
  const devices = await deviceService.getDevicesForClient(req.user.id);

  // Return raw array as per client spec
  return res.json(devices);
});

/**
 * Get Single Device
 * GET /api/v1/devices/:deviceId
 */
const getDevice = asyncHandler(async (req, res) => {
  const { deviceId } = req.params;

  const device = await deviceService.getDevice(req.user.id, parseInt(deviceId));

  return response.success(res, { data: device });
});

/**
 * Update Device
 * PUT /api/v1/devices/:deviceId
 */
const updateDevice = asyncHandler(async (req, res) => {
  const { deviceId } = req.params;

  const device = await deviceService.updateDevice(req.user.id, parseInt(deviceId), req.body);

  return response.success(res, {
    data: device,
    message: SUCCESS_MESSAGES.DEVICE_UPDATED
  });
});

/**
 * Delete Device
 * DELETE /api/v1/devices/:deviceId
 */
const deleteDevice = asyncHandler(async (req, res) => {
  const { deviceId } = req.params;

  const result = await deviceService.deleteDevice(req.user.id, parseInt(deviceId));

  return response.success(res, {
    data: result,
    message: SUCCESS_MESSAGES.DEVICE_DELETED
  });
});

/**
 * Send Command to Device
 * POST /api/v1/devices/:deviceId/command
 */
const sendCommand = asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  const { command } = req.body;

  // Get device
  const device = await deviceService.getDeviceForCommand(req.user.id, parseInt(deviceId));

  if (!device.is_online) {
    return response.badRequest(res, {
      message: 'Device is offline',
      errorCode: ERROR_CODES.DEVICE_OFFLINE
    });
  }

  // Log command
  await deviceService.logCommand(device.id, req.user.id, command);

  // Send via WebSocket
  if (wsManager) {
    const sent = wsManager.sendToDevice(device.cloud_id, {
      type: 'command',
      command
    });

    if (sent) {
      return response.success(res, {
        message: 'Command sent successfully'
      });
    }
  }

  return response.badRequest(res, {
    message: 'Device connection not available',
    errorCode: ERROR_CODES.DEVICE_COMMAND_FAILED
  });
});

/**
 * Trigger Device
 * POST /api/v1/devices/:deviceId/trigger
 */
const triggerDevice = asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  const { trigger } = req.body;

  // Get device
  const device = await deviceService.getDeviceForCommand(req.user.id, parseInt(deviceId));

  // Send via WebSocket
  if (wsManager) {
    const sent = wsManager.sendToDevice(device.cloud_id, {
      type: 'command',
      command: trigger
    });

    if (sent) {
      return response.success(res, {
        message: 'Device triggered successfully'
      });
    }
  }

  return response.badRequest(res, {
    message: 'Device offline or not connected',
    errorCode: ERROR_CODES.DEVICE_OFFLINE
  });
});

module.exports = {
  registerDevice,
  getDevices,
  getDevicesClient,
  getDevice,
  updateDevice,
  deleteDevice,
  sendCommand,
  triggerDevice,
  setWsManager
};