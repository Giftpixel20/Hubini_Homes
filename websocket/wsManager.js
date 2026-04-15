const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const deviceService = require('../services/deviceService');
const hubService = require('../services/hubService');

// Short app ID — max 20 chars (10 random bytes → 20 hex chars)
const generateAppId = () => crypto.randomBytes(10).toString('hex');

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map();       // userId -> Set<ws>  (authenticated app connections)
    this.appConnections = new Map(); // appId  -> ws       (all connections, auth or not)
    this.devices = new Map();        // dbId (string) -> ws
    this.hubs = new Map();           // dbId (string) -> ws
    this.deviceMeta = new Map();     // dbId -> { cloudId, userId, userPlan, devPlan }
    this.hubMeta = new Map();        // dbId -> { cloudId, userId }
  }

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────

  initialize(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    console.log(' WebSocket server initialized');
  }

  // ─────────────────────────────────────────────
  // CONNECTION
  // ─────────────────────────────────────────────

  handleConnection(ws, req) {
    console.log(' New WebSocket connection');

    ws.appId = generateAppId();
    ws.authenticated = false;
    ws.connectionType = null; // 'app' | 'device' | 'hub'

    this.appConnections.set(ws.appId, ws);

    // Tell the client its appID — no JSON
    this.send(ws, `connected|${ws.appId}`);

    ws.on('message', (data) => this.handleMessage(ws, data.toString().trim()));
    ws.on('close', () => this.handleDisconnect(ws));
    ws.on('error', (err) => console.error('WebSocket error:', err.message));
  }

  // ─────────────────────────────────────────────
  // MESSAGE ROUTER
  // ─────────────────────────────────────────────

  async handleMessage(ws, rawData) {
    try {
      const parts = rawData.split('|');
      const cmd = parts[0].toLowerCase();

      switch (cmd) {
        case 'mews': return this.handleDeviceMapping(ws, parts);  // device registration
        case 'mewh': return this.handleHubMapping(ws, parts);     // hub registration
        case 'auth': return this.handleAuth(ws, parts);
        case 'getds': return this.handleGetDevices(ws);
        case 'trigger': return this.handleTrigger(ws, parts);
        case 'ping': return this.handleDevicePing(ws);
        default:
          // Device sending a response back: <cmd>|<devToken>|<appId>|<data...>
          if (ws.connectionType === 'device') {
            return this.handleDeviceResponse(ws, cmd, parts);
          }
          this.send(ws, `error|Unknown command: ${cmd}`);
      }
    } catch (err) {
      console.error('WS message error:', err.message);
      this.send(ws, 'error|Error processing message');
    }
  }

  // ─────────────────────────────────────────────
  // DEVICE MAPPING  —  mews|<dbId>
  // ─────────────────────────────────────────────

  async handleDeviceMapping(ws, parts) {
    const dbId = parts[1]?.trim();
    if (!dbId || isNaN(dbId)) {
      return this.send(ws, 'error|Valid device ID required');
    }

    try {
      const device = await deviceService.getDeviceById(parseInt(dbId));
      if (!device) {
        return this.send(ws, `error|Device ${dbId} not found`);
      }

      ws.dbId = String(dbId);
      ws.cloudId = device.cloud_id;
      ws.connectionType = 'device';

      this.devices.set(String(dbId), ws);
      this.deviceMeta.set(String(dbId), {
        cloudId: device.cloud_id,
        userId: device.user_id,
        userPlan: 'free',   // extend when plan field added to users table
        devPlan: 'free'
      });

      // Cancel the activation-cleanup timer started at registration
      deviceService.cancelActivationTimer(parseInt(dbId));

      await deviceService.setDeviceOnline(device.cloud_id, true);

      console.log(` Device mapped: dbId=${dbId}, cloud_id=${device.cloud_id}`);
      this.send(ws, `registered|${dbId}`);
    } catch (err) {
      console.error('Device mapping error:', err.message);
      this.send(ws, 'error|Mapping failed');
    }
  }

  // ─────────────────────────────────────────────
  // HUB MAPPING  —  mewh|<dbId>
  // ─────────────────────────────────────────────

  async handleHubMapping(ws, parts) {
    const dbId = parts[1]?.trim();
    if (!dbId || isNaN(dbId)) {
      return this.send(ws, 'error|Valid hub ID required');
    }

    try {
      const hub = await hubService.getHubById(parseInt(dbId));
      if (!hub) {
        return this.send(ws, `error|Hub ${dbId} not found`);
      }

      ws.dbId = String(dbId);
      ws.cloudId = hub.cloud_id;
      ws.connectionType = 'hub';

      this.hubs.set(String(dbId), ws);
      this.hubMeta.set(String(dbId), {
        cloudId: hub.cloud_id,
        userId: hub.user_id
      });

      hubService.cancelActivationTimer(parseInt(dbId));

      await hubService.setHubOnline(hub.cloud_id, true);

      console.log(` Hub mapped: dbId=${dbId}, cloud_id=${hub.cloud_id}`);
      this.send(ws, `registered|${dbId}`);
    } catch (err) {
      console.error('Hub mapping error:', err.message);
      this.send(ws, 'error|Mapping failed');
    }
  }

  // ─────────────────────────────────────────────
  // CLIENT AUTH  —  auth|<jwt>
  // ─────────────────────────────────────────────

  async handleAuth(ws, parts) {
    const token = parts[1];
    if (!token) {
      return this.send(ws, 'error|Token required');
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      ws.userId = decoded.userId;
      ws.authenticated = true;
      ws.connectionType = 'app';

      if (!this.clients.has(decoded.userId)) {
        this.clients.set(decoded.userId, new Set());
      }
      this.clients.get(decoded.userId).add(ws);

      console.log(` Client authenticated: userId=${decoded.userId}, appId=${ws.appId}`);
      this.send(ws, 'auth_success');
    } catch (err) {
      this.send(ws, 'error|Invalid token');
    }
  }

  // ─────────────────────────────────────────────
  // GET DEVICES  —  getds
  // Response format:  ds|<id>:<localId>:<name>:<type>:<state>:<trigs>|...
  // ─────────────────────────────────────────────

  async handleGetDevices(ws) {
    if (!ws.authenticated || !ws.userId) {
      return this.send(ws, 'error|Not authenticated');
    }

    try {
      const devices = await deviceService.getDevicesForClient(ws.userId);

      if (devices.length === 0) {
        return this.send(ws, 'ds|empty');
      }

      const encoded = devices.map(d =>
        `${d.id}:${d.Local_ID}:${d.name}:${d.type}:${d.Last_state || 'unknown'}:${d.Trigs || ''}`
      ).join('|');

      this.send(ws, `ds|${encoded}`);
    } catch (err) {
      console.error('Error fetching devices:', err.message);
      this.send(ws, 'error|Failed to fetch devices');
    }
  }

  // ─────────────────────────────────────────────
  // TRIGGER / RELAY  —  trigger|<dbDeviceId>|<cmd>|<args...>
  //
  // Relay to device:
  //   <cmd>|<devToken>|<appId>|<userPlan>|<devPlan>|<args>
  // ─────────────────────────────────────────────

  async handleTrigger(ws, parts) {
    if (!ws.authenticated || !ws.userId) {
      return this.send(ws, 'error|Not authenticated');
    }

    const dbDeviceId = parts[1];
    const cmd = parts[2];
    const args = parts.slice(3).join('|');

    if (!dbDeviceId || !cmd) {
      return this.send(ws, 'error|Device ID and command required');
    }

    try {
      const device = await deviceService.getDeviceForCommand(ws.userId, parseInt(dbDeviceId));
      const meta = this.deviceMeta.get(String(dbDeviceId));
      const targetWs = this.devices.get(String(dbDeviceId));

      if (!targetWs || targetWs.readyState !== 1) {
        return this.send(ws, 'error|Device offline');
      }

      // Build relay message — appId spot uses ws.appId (the sending client's appId)
      const userPlan = meta?.userPlan || 'free';
      const devPlan = meta?.devPlan || 'free';
      const devToken = meta?.cloudId || String(dbDeviceId);

      const relay = args
        ? `${cmd}|${devToken}|${ws.appId}|${userPlan}|${devPlan}|${args}`
        : `${cmd}|${devToken}|${ws.appId}|${userPlan}|${devPlan}`;

      this.send(targetWs, relay);

      await deviceService.logCommand(device.id, ws.userId, cmd);
    } catch (err) {
      this.send(ws, `error|${err.message || 'Failed to trigger device'}`);
    }
  }

  // ─────────────────────────────────────────────
  // DEVICE PING  —  ping  (device → cloud every 30 s)
  // ─────────────────────────────────────────────

  async handleDevicePing(ws) {
    if (ws.cloudId) {
      try {
        await deviceService.setDeviceOnline(ws.cloudId, true); // refreshes last_seen
      } catch (err) { /* non-critical */ }
    }
    this.send(ws, 'pong');
  }

  // ─────────────────────────────────────────────
  // DEVICE RESPONSE  —  <cmd>|<devToken>|<appId>|<data...>
  //
  // If appId == '-'  →  server-device only, no relay
  // Otherwise        →  relay back to the originating app
  //   App receives:  <cmd>|<appId>|<data>
  // ─────────────────────────────────────────────

  async handleDeviceResponse(ws, cmd, parts) {
    const devToken = parts[1];
    const appId = parts[2];
    const data = parts.slice(3).join('|');

    // Internal server-device message (appId blank)
    if (!appId || appId === '-') {
      await this._handleInternalDeviceMessage(ws, cmd, data);
      return;
    }

    // Update device state in DB with response data (best-effort)
    if (ws.dbId) {
      try {
        await deviceService.updateDeviceState(parseInt(ws.dbId), data);
      } catch (err) { /* non-critical */ }
    }

    // Relay to originating app — restructure: <cmd>|<appId>|<data>
    const appWs = this.appConnections.get(appId);
    if (appWs && appWs.readyState === 1) {
      this.send(appWs, `${cmd}|${appId}|${data}`);
    }
  }

  async _handleInternalDeviceMessage(ws, cmd, data) {
    if (!ws.dbId) return;

    try {
      await deviceService.updateDeviceState(parseInt(ws.dbId), data);
      const meta = this.deviceMeta.get(ws.dbId);
      if (meta) {
        // Notify all of the owner's app connections
        this.notifyUser(meta.userId, `device_state|${ws.dbId}|${data}`);
      }
    } catch (err) {
      console.error('Internal device message error:', err.message);
    }
  }

  // ─────────────────────────────────────────────
  // DISCONNECT
  // ─────────────────────────────────────────────

  async handleDisconnect(ws) {
    if (ws.appId) {
      this.appConnections.delete(ws.appId);
    }

    if (ws.userId && this.clients.has(ws.userId)) {
      this.clients.get(ws.userId).delete(ws);
      if (this.clients.get(ws.userId).size === 0) {
        this.clients.delete(ws.userId);
      }
    }

    if (ws.connectionType === 'device' && ws.dbId) {
      this.devices.delete(ws.dbId);
      this.deviceMeta.delete(ws.dbId);
      if (ws.cloudId) {
        try { await deviceService.setDeviceOnline(ws.cloudId, false); } catch (e) { /* ignore */ }
      }
      console.log(` Device disconnected: dbId=${ws.dbId}`);
    }

    if (ws.connectionType === 'hub' && ws.dbId) {
      this.hubs.delete(ws.dbId);
      this.hubMeta.delete(ws.dbId);
      if (ws.cloudId) {
        try { await hubService.setHubOnline(ws.cloudId, false); } catch (e) { /* ignore */ }
      }
      console.log(` Hub disconnected: dbId=${ws.dbId}`);
    }
  }

  // ─────────────────────────────────────────────
  // PUBLIC HELPERS
  // ─────────────────────────────────────────────

  /**
   * Send a command to a device from an HTTP request (no app WS session).
   * Format: <cmd>|<devToken>|<appId '-'>|<userPlan>|<devPlan>|<args>
   */
  sendCommandToDevice(dbId, cmd, args = '') {
    const ws = this.devices.get(String(dbId));
    if (!ws || ws.readyState !== 1) return false;

    const meta = this.deviceMeta.get(String(dbId));
    const devToken = meta?.cloudId || String(dbId);
    const userPlan = meta?.userPlan || 'free';
    const devPlan = meta?.devPlan || 'free';

    const message = args
      ? `${cmd}|${devToken}|-|${userPlan}|${devPlan}|${args}`
      : `${cmd}|${devToken}|-|${userPlan}|${devPlan}`;

    this.send(ws, message);
    return true;
  }

  /**
   * Notify all WS connections belonging to a user.
   */
  notifyUser(userId, message) {
    const connections = this.clients.get(userId);
    if (connections) {
      connections.forEach((ws) => {
        if (ws.readyState === 1) this.send(ws, message);
      });
    }
  }

  send(ws, data) {
    if (ws.readyState === 1) {
      ws.send(data);
    }
  }

  getStats() {
    return {
      totalConnections: this.wss?.clients.size || 0,
      authenticatedClients: this.clients.size,
      connectedDevices: this.devices.size,
      connectedHubs: this.hubs.size
    };
  }

  shutdown() {
    if (this.wss) this.wss.close();
  }
}

const wsManager = new WebSocketManager();
module.exports = wsManager;
