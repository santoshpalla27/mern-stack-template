const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

// Get architecture information
router.get('/', (req, res) => {
  try {
    const architecture = {
      name: 'MERN DevOps Demo',
      version: '2.0.0',
      type: 'microservices',
      components: [
        {
          id: 'frontend',
          name: 'React Frontend',
          type: 'web',
          technology: 'React + Vite + TailwindCSS',
          port: 3000,
          description: 'Real-time monitoring dashboard',
          status: 'running',
          connections: ['backend']
        },
        {
          id: 'backend',
          name: 'Express API',
          type: 'api',
          technology: 'Node.js + Express',
          port: 5000,
          description: 'RESTful API with health monitoring',
          status: 'running',
          connections: ['mongodb', 'redis'],
          endpoints: [
            { path: '/api/', method: 'GET', description: 'Basic status' },
            { path: '/api/health', method: 'GET', description: 'Health check' },
            { path: '/api/status', method: 'GET', description: 'Detailed status' },
            { path: '/api/architecture', method: 'GET', description: 'Architecture info' }
          ]
        },
        {
          id: 'mongodb',
          name: 'MongoDB',
          type: 'database',
          technology: 'MongoDB 7.0',
          port: 27017,
          description: 'NoSQL document database',
          status: 'running',
          connections: []
        },
        {
          id: 'redis',
          name: 'Redis',
          type: 'cache',
          technology: 'Redis 7',
          port: 6379,
          description: 'In-memory cache and message broker',
          status: process.env.REDIS_URI ? 'configured' : 'optional',
          connections: []
        }
      ],
      dataFlow: [
        {
          from: 'frontend',
          to: 'backend',
          protocol: 'HTTP/REST',
          description: 'API requests for status and health'
        },
        {
          from: 'backend',
          to: 'mongodb',
          protocol: 'MongoDB Wire Protocol',
          description: 'Database queries and operations'
        },
        {
          from: 'backend',
          to: 'redis',
          protocol: 'RESP',
          description: 'Cache operations and pub/sub'
        }
      ],
      deployment: {
        platform: process.env.DEPLOYMENT_PLATFORM || 'Docker Compose',
        environment: process.env.NODE_ENV || 'development',
        containerization: 'Docker',
        orchestration: process.env.ORCHESTRATION || 'Docker Compose',
        networking: 'Bridge Network (devops-network)',
        volumes: ['mongodb_data', 'redis_data']
      },
      scaling: {
        frontend: {
          type: 'horizontal',
          instances: parseInt(process.env.FRONTEND_REPLICAS) || 1,
          loadBalancer: process.env.LOAD_BALANCER || 'none'
        },
        backend: {
          type: 'horizontal',
          instances: parseInt(process.env.BACKEND_REPLICAS) || 1,
          loadBalancer: process.env.LOAD_BALANCER || 'none'
        }
      }
    };

    logger.info('Architecture information requested');
    res.json(architecture);
  } catch (error) {
    logger.error('Error getting architecture:', error);
    res.status(500).json({
      error: 'Failed to retrieve architecture',
      message: error.message
    });
  }
});

module.exports = router;