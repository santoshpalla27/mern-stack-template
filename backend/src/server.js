require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoConnection = require('./config/mongodb');
const redisConnection = require('./config/redis');
const statusRoutes = require('./routes/status');
const architectureRoutes = require('./routes/architecture');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Routes
app.use('/api', statusRoutes);
app.use('/api/architecture', architectureRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
    availableEndpoints: [
      '/api/',
      '/api/health',
      '/api/status',
      '/api/architecture'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
    timestamp: new Date().toISOString()
  });
});

// Initialize connections
const initializeConnections = async () => {
  logger.info('🚀 Initializing connections...');
  
  // MongoDB connection
  try {
    await mongoConnection.connect();
  } catch (error) {
    logger.error('MongoDB initial connection failed, will retry in background');
  }
  
  // Redis connection
  try {
    await redisConnection.connect();
  } catch (error) {
    logger.error('Redis initial connection failed, will retry in background');
  }
  
  logger.info('✅ Connection initialization completed');
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`\n${signal} received, closing server gracefully...`);
  
  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Close database connections
    try {
      await Promise.all([
        mongoConnection.disconnect(),
        redisConnection.disconnect()
      ]);
      logger.info('All connections closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000); // 30 seconds timeout
};

// Process event handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 API Base URL: http://localhost:${PORT}/api`);
  
  // Initialize connections after server starts
  await initializeConnections();
  
  logger.info('✨ Application ready to accept connections');
});

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error:', error);
  process.exit(1);
});

module.exports = app;