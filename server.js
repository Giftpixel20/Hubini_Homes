require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const session = require('express-session');
const http = require('http');

// Config
const { testConnection } = require('./config/database');

// Middlewares
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');

// Routes
const routes = require('./routes');

// WebSocket
const wsManager = require('./websocket/wsManager');

// Controllers that need wsManager
const deviceController = require('./controllers/deviceController');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


app.use(session({
  secret: process.env.SESSION_SECRET || 'hubini-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// ==================== ROUTES ====================

// Health check
app.get('/health', (req, res) => {
  const stats = wsManager.getStats();
  res.json({
    success: true,
    message: 'Hubini Cloud API is running!',
    timestamp: new Date().toISOString(),
    websocket: stats
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Hubini Cloud API is running!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      devices: '/api/v1/devices',
      hubs: '/api/v1/hubs',
      users: '/api/v1/users'
    }
  });
});


try {
  const checkLoginRouter = require('./controllers/auths/check_login');
  app.use('/check-login', checkLoginRouter);
} catch (err) {
  
}

// API routes with rate limiting
app.use('/api/v1', apiLimiter, routes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// ==================== SERVER SETUP ====================

const server = http.createServer(app);

// Initialize WebSocket
wsManager.initialize(server);


deviceController.setWsManager(wsManager);

// ==================== START SERVER ====================

async function startServer() {

  await testConnection();

  server.listen(PORT, () => {
    console.log(`
   
     Hubini Cloud Server Started!
  
  
   HTTP Server:  http://localhost:${PORT}
   WebSocket:    ws://localhost:${PORT}/ws
   Health:       http://localhost:${PORT}/health
  
   API Endpoints:
     Auth:    /api/v1/auth
     Devices: /api/v1/devices
     Hubs:    /api/v1/hubs
     Users:   /api/v1/users
  
   Environment: ${process.env.NODE_ENV || 'development'}

    `);
  });
}

startServer();


const shutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  wsManager.shutdown();
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server, wsManager };