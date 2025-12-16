const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const deviceService = require('../services/deviceService');
const hubService = require('../services/hubService');

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map();  // userId -> Set of ws connections
    this.devices = new Map();  // cloudId -> ws connection
    this.hubs = new Map();     // cloudId -> ws connection
    this.heartbeatInterval = null;
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat
    this.startHeartbeat();

    console.log(' WebSocket server initialized');
  }

  /**
   * Handle new connection
   */
  handleConnection(ws, req) {
    console.log(' New WebSocket connection');

    ws.isAlive = true;
    ws.authenticated = false;

    // Send welcome
    this.send(ws, {
      type: 'connected',
      message: 'Connected to Hubini WebSocket. Please authenticate.'
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      this.handleMessage(ws, data.toString());
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
    });
  }

  /**
   * Handle incoming message
   */
  async handleMessage(ws, rawData) {
    try {
      // Handle device protocol: MeWs|CLOUDID
      if (rawData.includes('|') && !rawData.startsWith('{')) {
        return this.handleDeviceProtocol(ws, rawData);
      }

      // Parse JSON message
      let message;
      try {
        message = JSON.parse(rawData);
      } catch {
        return this.sendError(ws, 'Invalid message format');
      }

      // Handle different message types
      switch (message.type || message.cmd) {
        case 'auth':
          await this.handleAuth(ws, message);
          break;

        case 'device_register':
          await this.handleDeviceRegister(ws, message);
          break;

        case 'hub_register':
          await this.handleHubRegister(ws, message);
          break;

        case 'getDs':
          await this.handleGetDevices(ws);
          break;

        case 'trigger':
          await this.handleTrigger(ws, message);
          break;

        case 'device_state':
          await this.handleDeviceState(ws, message);
          break;

        case 'heartbeat':
          ws.isAlive = true;
          this.send(ws, { type: 'heartbeat_ack' });
          break;

        default:
          console.log('Unknown message type:', message.type || message.cmd);
      }
    } catch (error) {
      console.error('WebSocket message error:', error.message);
      this.sendError(ws, 'Error processing message');
    }
  }

  /**
   * Handle device protocol: MeWs|CLOUDID
   */
  async handleDeviceProtocol(ws, rawData) {
    const [cmd, cloudId] = rawData.split('|');

    if (cmd === 'MeWs' && cloudId) {
      const trimmedId = cloudId.trim();
      ws.cloudId = trimmedId;

      if (trimmedId.startsWith('DEV_')) {
        this.devices.set(trimmedId, ws);
        ws.connectionType = 'device';
        
        try {
          await deviceService.setDeviceOnline(trimmedId, true);
        } catch (err) {
          console.error('Failed to update device status:', err.message);
        }
        
        console.log(` Device connected: ${trimmedId}`);
      } else if (trimmedId.startsWith('HUB_')) {
        this.hubs.set(trimmedId, ws);
        ws.connectionType = 'hub';
        
        try {
          await hubService.setHubOnline(trimmedId, true);
        } catch (err) {
          console.error('Failed to update hub status:', err.message);
        }
        
        console.log(` Hub connected: ${trimmedId}`);
      }

      this.send(ws, { type: 'registered', cloudId: trimmedId });
    }
  }

  /**
   * Handle client authentication
   */
  async handleAuth(ws, message) {
    try {
      const { token } = message;

      if (!token) {
        return this.sendError(ws, 'Token required');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      ws.userId = decoded.userId;
      ws.authenticated = true;

      // Add to clients map
      if (!this.clients.has(decoded.userId)) {
        this.clients.set(decoded.userId, new Set());
      }
      this.clients.get(decoded.userId).add(ws);

      console.log(` Client authenticated: User ${decoded.userId}`);
      this.send(ws, { type: 'auth_success', message: 'Authenticated' });
    } catch (error) {
      this.sendError(ws, 'Invalid token');
    }
  }

  /**
   * Handle device registration via JSON
   */
  async handleDeviceRegister(ws, message) {
    const { cloudId } = message;

    if (!cloudId) {
      return this.sendError(ws, 'Cloud ID required');
    }

    ws.cloudId = cloudId;
    ws.connectionType = 'device';
    this.devices.set(cloudId, ws);

    try {
      await deviceService.setDeviceOnline(cloudId, true);
    } catch (err) {
      console.error('Failed to update device status:', err.message);
    }

    console.log(` Device registered: ${cloudId}`);
    this.send(ws, { type: 'device_registered', cloudId });
  }

  /**
   * Handle hub registration via JSON
   */
  async handleHubRegister(ws, message) {
    const { cloudId } = message;

    if (!cloudId) {
      return this.sendError(ws, 'Cloud ID required');
    }

    ws.cloudId = cloudId;
    ws.connectionType = 'hub';
    this.hubs.set(cloudId, ws);

    try {
      await hubService.setHubOnline(cloudId, true);
    } catch (err) {
      console.error('Failed to update hub status:', err.message);
    }

    console.log(` Hub registered: ${cloudId}`);
    this.send(ws, { type: 'hub_registered', cloudId });
  }

  /**
   * Handle getDs command
   */
  async handleGetDevices(ws) {
    if (!ws.authenticated || !ws.userId) {
      return this.sendError(ws, 'Not authenticated');
    }

    try {
      const devices = await deviceService.getDevicesForClient(ws.userId);
      this.send(ws, devices);
    } catch (error) {
      console.error('Error fetching devices:', error.message);
      this.sendError(ws, 'Failed to fetch devices');
    }
  }

  /**
   * Handle trigger command
   */
  async handleTrigger(ws, message) {
    if (!ws.authenticated || !ws.userId) {
      return this.sendError(ws, 'Not authenticated');
    }

    const { deviceId, command } = message;

    if (!deviceId || !command) {
      return this.sendError(ws, 'Device ID and command required');
    }

    try {
      const device = await deviceService.getDeviceForCommand(ws.userId, parseInt(deviceId));

      const targetWs = this.devices.get(device.cloud_id);
      if (targetWs && targetWs.readyState === 1) {
        this.send(targetWs, { type: 'command', command });
        this.send(ws, { type: 'command_sent', deviceId, command });
      } else {
        this.sendError(ws, 'Device offline');
      }
    } catch (error) {
      this.sendError(ws, error.message || 'Failed to trigger device');
    }
  }

  /**
   * Handle device state update
   */
  async handleDeviceState(ws, message) {
    const { cloudId, state } = message;

    if (!cloudId || state === undefined) {
      return;
    }

    try {
      const device = await deviceService.getDeviceByCloudId(cloudId);
      
      if (device) {
        await deviceService.updateDeviceState(device.id, state);

        // Notify user clients
        this.notifyUser(device.user_id, {
          type: 'device_state_update',
          deviceId: device.id,
          cloudId,
          state
        });
      }
    } catch (error) {
      console.error('Error updating device state:', error.message);
    }
  }

  /**
   * Handle disconnect
   */
  async handleDisconnect(ws) {
    // Remove from clients
    if (ws.userId && this.clients.has(ws.userId)) {
      this.clients.get(ws.userId).delete(ws);
      if (this.clients.get(ws.userId).size === 0) {
        this.clients.delete(ws.userId);
      }
    }

    // Handle device disconnect
    if (ws.cloudId && ws.connectionType === 'device') {
      this.devices.delete(ws.cloudId);
      try {
        await deviceService.setDeviceOnline(ws.cloudId, false);
      } catch (err) {
        // Ignore
      }
      console.log(` Device disconnected: ${ws.cloudId}`);
    }

    // Handle hub disconnect
    if (ws.cloudId && ws.connectionType === 'hub') {
      this.hubs.delete(ws.cloudId);
      try {
        await hubService.setHubOnline(ws.cloudId, false);
      } catch (err) {
        // Ignore
      }
      console.log(` Hub disconnected: ${ws.cloudId}`);
    }
  }

  /**
   * Start heartbeat check
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  /**
   * Send message to device by cloudId
   */
  sendToDevice(cloudId, data) {
    const ws = this.devices.get(cloudId);
    if (ws && ws.readyState === 1) {
      this.send(ws, data);
      return true;
    }
    return false;
  }

  /**
   * Send message to hub by cloudId
   */
  sendToHub(cloudId, data) {
    const ws = this.hubs.get(cloudId);
    if (ws && ws.readyState === 1) {
      this.send(ws, data);
      return true;
    }
    return false;
  }

  /**
   * Notify all user's connected clients
   */
  notifyUser(userId, data) {
    const connections = this.clients.get(userId);
    if (connections) {
      connections.forEach((ws) => {
        if (ws.readyState === 1) {
          this.send(ws, data);
        }
      });
    }
  }

  /**
   * Send JSON message
   */
  send(ws, data) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Send error message
   */
  sendError(ws, message) {
    this.send(ws, { type: 'error', message });
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      totalConnections: this.wss?.clients.size || 0,
      authenticatedClients: this.clients.size,
      connectedDevices: this.devices.size,
      connectedHubs: this.hubs.size
    };
  }

  /**
   * Shutdown
   */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
  }
}

// Create singleton instance
const wsManager = new WebSocketManager();

module.exports = wsManager;