

const WebSocket = require('ws');



const CLOUD_ID = process.argv[2] || 'DEV_TEST_12345678';
const SERVER_URL = process.env.WS_URL || 'ws://localhost:1000/ws';


console.log("Simulator working");


let ws;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

function connect() {
  console.log('📡 Connecting to server...');
  
  ws = new WebSocket(SERVER_URL);

  ws.on('open', () => {
    console.log(' Connected to WebSocket server');
    reconnectAttempts = 0;

    // Register device using protocol format
    console.log(` Registering device: MeWs|${CLOUD_ID}`);
    ws.send(`MeWs|${CLOUD_ID}`);
  });

  ws.on('message', (data) => {
    const message = data.toString();
    console.log(' Received:', message);

    try {
      const parsed = JSON.parse(message);

      
      if (parsed.type === 'command') {
        console.log(` Command received: ${parsed.command}`);
        
        
        const newState = parsed.command; 
        sendStateUpdate(newState);
      }
    } catch (e) {
    
    }
  });

  ws.on('close', () => {
    console.log(' Disconnected from server');
    
    // Try to reconnect
    if (reconnectAttempts < MAX_RECONNECT) {
      reconnectAttempts++;
      console.log(` Reconnecting in 3 seconds... (attempt ${reconnectAttempts}/${MAX_RECONNECT})`);
      setTimeout(connect, 3000);
    } else {
      console.log(' Max reconnection attempts reached. Exiting.');
      process.exit(1);
    }
  });

  ws.on('error', (err) => {
    console.error(' WebSocket error:', err.message);
  });
}

// Send state update to server
function sendStateUpdate(state) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const message = JSON.stringify({
      type: 'device_state',
      cloudId: CLOUD_ID,
      state: state
    });
    console.log(` Sending state update: ${state}`);
    ws.send(message);
  }
}

// Send heartbeat
function sendHeartbeat() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'heartbeat' }));
    console.log(' Heartbeat sent');
  }
}

// Start connection
connect();

// Send heartbeat every 25 seconds
setInterval(sendHeartbeat, 25000);

// Interactive commands
console.log('\n Commands:');
console.log('  Type "on" or "off" to simulate state changes');
console.log('  Type "quit" to disconnect\n');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
  const cmd = input.trim().toLowerCase();
  
  if (cmd === 'quit' || cmd === 'exit') {
    console.log(' Disconnecting...');
    ws.close();
    process.exit(0);
  } else if (cmd === 'on' || cmd === 'off' || cmd === 'toggle') {
    sendStateUpdate(cmd);
  } else if (cmd) {
    sendStateUpdate(cmd);
  }
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n Shutting down device...');
  if (ws) ws.close();
  process.exit(0);
});