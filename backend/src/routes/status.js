const express = require('express');
const mongoConnection = require('../config/mongodb');
const redisConnection = require('../config/redis');
const logger = require('../utils/logger');

const router = express.Router();

// Track application start time
const startTime = Date.now();

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
    minutes: minutes,
    hours: hours,
    days: days,
    formatted: `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`
  };
};

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'Backend running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0'
  });
});

// Health check endpoint
router.get('/health', async (req, res) => {
  const mongoStatus = mongoConnection.getStatus();
  const redisStatus = redisConnection.getStatus();
  
  const isHealthy = mongoStatus.connected && 
                    (redisStatus.connected || !process.env.REDIS_URI);

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      mongodb: mongoStatus.connected ? 'pass' : 'fail',
      redis: !process.env.REDIS_URI ? 'skipped' : (redisStatus.connected ? 'pass' : 'fail')
    }
  });
});

// Detailed status endpoint
router.get('/status', async (req, res) => {
  try {
    const mongoStatus = mongoConnection.getStatus();
    const redisStatus = redisConnection.getStatus();
    const uptime = getUptime();

    // Test Redis ping if connected
    let redisPing = null;
    if (redisStatus.connected) {
      try {
        const pingStart = Date.now();
        const pingResult = await redisConnection.ping();
        redisPing = {
          success: pingResult,
          latency: Date.now() - pingStart
        };
      } catch (error) {
        redisPing = {
          success: false,
          error: error.message
        };
      }
    }

    const statusReport = {
      application: {
        name: 'MERN DevOps Demo',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        status: 'running',
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version
      },
      uptime: uptime,
      services: {
        backend: {
          connected: true,
          message: 'Running',
          status: 'healthy',
          lastChecked: new Date().toISOString(),
          port: process.env.PORT || 5000,
          uptime: uptime.formatted
        },
        mongodb: {
          connected: mongoStatus.connected,
          message: mongoStatus.message,
          lastChecked: mongoStatus.lastChecked,
          connectionAttempts: mongoStatus.connectionAttempts,
          lastError: mongoStatus.lastError,
          readyState: mongoStatus.readyState,
          readyStateLabel: mongoStatus.readyStateLabel,
          architecture: {
            topology: mongoStatus.topology,
            replicaSet: mongoStatus.replicaSet,
            nodes: mongoStatus.nodes
          },
          uri: process.env.MONGO_URI ? '***configured***' : 'not configured'
        },
        redis: {
          connected: redisStatus.connected,
          message: redisStatus.message,
          lastChecked: redisStatus.lastChecked,
          connectionAttempts: redisStatus.connectionAttempts,
          lastError: redisStatus.lastError,
          ping: redisPing,
          architecture: {
            mode: redisStatus.mode,
            role: redisStatus.role,
            clusterNodes: redisStatus.clusterNodes
          },
          uri: process.env.REDIS_URI ? '***configured***' : 'not configured'
        }
      },
      memory: {
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        external: `${(process.memoryUsage().external / 1024 / 1024).toFixed(2)} MB`
      },
      timestamp: new Date().toISOString()
    };

    logger.info('Status check requested');
    res.json(statusReport);
  } catch (error) {
    logger.error('Error in status endpoint:', error);
    res.status(500).json({
      error: 'Failed to retrieve status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;