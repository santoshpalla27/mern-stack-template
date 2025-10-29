const express = require('express');
const { getMongoStatus } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Track application start time
const startTime = Date.now();

// Redis connection status (placeholder)
let redisStatus = {
  connected: false,
  message: 'Redis not configured (optional)',
  lastChecked: new Date().toISOString()
};

// If REDIS_URI is provided, attempt connection
if (process.env.REDIS_URI) {
  const redis = require('redis');
  const redisClient = redis.createClient({
    url: process.env.REDIS_URI,
    socket: {
      connectTimeout: 5000
    }
  });

  redisClient.on('connect', () => {
    redisStatus = {
      connected: true,
      message: 'Connected',
      lastChecked: new Date().toISOString()
    };
    logger.info('Redis connected');
  });

  redisClient.on('error', (err) => {
    redisStatus = {
      connected: false,
      message: err.message,
      lastChecked: new Date().toISOString()
    };
    logger.error('Redis error:', err.message);
  });

  redisClient.connect().catch((err) => {
    logger.error('Redis connection failed:', err.message);
  });
}

// Calculate uptime
const getUptime = () => {
  const uptimeMs = Date.now() - startTime;
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  return {
    milliseconds: uptimeMs,
    seconds: seconds,
    formatted: `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`
  };
};

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'Backend running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check endpoint
router.get('/health', (req, res) => {
  const mongoStatus = getMongoStatus();
  const isHealthy = mongoStatus.connected;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString()
  });
});

// Detailed status endpoint
router.get('/status', (req, res) => {
  try {
    const mongoStatus = getMongoStatus();
    const uptime = getUptime();

    const statusReport = {
      application: {
        name: 'MERN DevOps Demo',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        status: 'running'
      },
      uptime: uptime,
      services: {
        mongodb: {
          connected: mongoStatus.connected,
          message: mongoStatus.message,
          lastChecked: mongoStatus.lastChecked,
          uri: process.env.MONGO_URI ? '***configured***' : 'not configured'
        },
        redis: {
          connected: redisStatus.connected,
          message: redisStatus.message,
          lastChecked: redisStatus.lastChecked,
          uri: process.env.REDIS_URI ? '***configured***' : 'not configured'
        }
      },
      timestamp: new Date().toISOString()
    };

    logger.info('Status check requested');
    res.json(statusReport);
  } catch (error) {
    logger.error('Error in status endpoint:', error);
    res.status(500).json({
      error: 'Failed to retrieve status',
      message: error.message
    });
  }
});

module.exports = router;