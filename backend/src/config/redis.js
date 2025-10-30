const Redis = require('ioredis');
const logger = require('../utils/logger');

class RedisConnection {
  constructor() {
    this.client = null;
    this.status = {
      connected: false,
      message: 'Not initialized',
      lastChecked: null,
      connectionAttempts: 0,
      lastError: null,
      mode: null,
      role: null,
      clusterNodes: []
    };
    
    this.maxRetries = parseInt(process.env.REDIS_MAX_RETRIES) || 30;
    this.retryDelay = parseInt(process.env.REDIS_RETRY_DELAY) || 5000;
    this.currentRetry = 0;
    this.isReconnecting = false;
    this.isSentinel = false;
    this.isCluster = false;
  }

  updateStatus(updates) {
    this.status = {
      ...this.status,
      ...updates,
      lastChecked: new Date().toISOString(),
      connectionAttempts: this.status.connectionAttempts + 1
    };
  }

  async getRedisInfo() {
    if (!this.client || this.client.status !== 'ready') return;

    try {
      // ✅ ADD THIS FOR CLUSTER
      if (this.isCluster) {
        this.status.mode = 'cluster';
        this.status.role = 'cluster-node';
        logger.info(`📊 Redis architecture: cluster`);
        return;
      }

      // Existing code for Sentinel
      if (this.isSentinel) {
        this.status.mode = 'sentinel';
        this.status.role = 'managed-by-sentinel';
        logger.info(`📊 Redis architecture: sentinel`);
        return;
      }

      // Existing code for standalone/replication
      const info = await this.client.info();
      const infoObj = this.parseRedisInfo(info);

      let mode = 'standalone';
      let role = infoObj.role || 'master';
      let clusterNodes = [];

      if (infoObj.cluster_enabled === '1') {
        mode = 'cluster';
      } else if (role === 'slave') {
        mode = 'replication';
      } else if (role === 'master' && parseInt(infoObj.connected_slaves) > 0) {
        mode = 'replication';
      }

      this.status.mode = mode;
      this.status.role = role;
      this.status.clusterNodes = clusterNodes;

      logger.info(`📊 Redis architecture: ${mode} (role: ${role})`);

    } catch (error) {
      logger.error('Error getting Redis info:', error.message);
    }
  }

  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const result = {};
    
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value !== undefined) {
          result[key] = value.trim();
        }
      }
    }
    
    return result;
  }

  setupEventListeners() {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('⚡ Redis connecting...');
    });

    this.client.on('ready', async () => {
      this.currentRetry = 0;
      this.isReconnecting = false;
      this.updateStatus({
        connected: true,
        message: 'Connected successfully',
        lastError: null
      });
      
      await this.getRedisInfo();
      logger.info('✅ Redis ready');
    });

    this.client.on('error', (err) => {
      this.updateStatus({
        connected: false,
        message: 'Connection error',
        lastError: err.message
      });
      logger.error('❌ Redis error:', err.message);
    });

    this.client.on('close', () => {
      this.updateStatus({
        connected: false,
        message: 'Connection closed',
        mode: null,
        role: null,
        clusterNodes: []
      });
      logger.warn('⚠️  Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
      this.updateStatus({
        message: 'Reconnecting...'
      });
    });
  }

  async connect() {
    const sentinelHosts = process.env.REDIS_SENTINEL_HOSTS;
    const sentinelMaster = process.env.REDIS_SENTINEL_MASTER || 'mymaster';
    const clusterNodes = process.env.REDIS_CLUSTER_NODES;  // ✅ ADD THIS
    const redisURI = process.env.REDIS_URI;
    
    // ✅ UPDATE THIS CONDITION
    if (!sentinelHosts && !redisURI && !clusterNodes) {
      this.updateStatus({
        connected: false,
        message: 'Redis not configured (optional)',
        lastError: null
      });
      logger.info('ℹ️  Redis not configured, skipping connection');
      return;
    }

    try {
      // ✅ ADD REDIS CLUSTER CONFIGURATION (BEFORE SENTINEL)
      if (clusterNodes) {
        logger.info('🔍 Using Redis Cluster configuration');
        
        const nodes = clusterNodes.split(',').map(node => {
          const [host, port] = node.trim().split(':');
          return { host, port: parseInt(port) || 7001 };
        });

        logger.info(`🔍 Cluster nodes: ${JSON.stringify(nodes)}`);

        this.client = new Redis.Cluster(nodes, {
          redisOptions: {
            connectTimeout: 10000,
            maxRetriesPerRequest: 3,
          },
          clusterRetryStrategy: (times) => {
            if (times > this.maxRetries) {
              logger.error('❌ Max Redis cluster reconnection attempts reached');
              return null;
            }
            const delay = Math.min(times * this.retryDelay, 30000);
            logger.info(`🔄 Redis cluster reconnect attempt ${times} in ${delay}ms`);
            return delay;
          },
          enableReadyCheck: true,
        });

        this.isCluster = true;
        this.setupEventListeners();
        logger.info('🔌 Connecting to Redis Cluster...');

      }
      // SENTINEL CONFIGURATION (existing code)
      else if (sentinelHosts) {
        logger.info('🔍 Using Redis Sentinel configuration');
        
        const sentinels = sentinelHosts.split(',').map(host => {
          const [hostname, port] = host.trim().split(':');
          return { host: hostname, port: parseInt(port) || 26379 };
        });

        logger.info(`🔍 Sentinel hosts: ${JSON.stringify(sentinels)}`);
        logger.info(`🔍 Sentinel master name: ${sentinelMaster}`);

        this.client = new Redis({
          sentinels: sentinels,
          name: sentinelMaster,
          sentinelRetryStrategy: (times) => {
            if (times > 10) {
              logger.error('❌ Max Sentinel retries reached');
              return null;
            }
            const delay = Math.min(times * 1000, 5000);
            logger.info(`🔄 Sentinel retry attempt ${times} in ${delay}ms`);
            return delay;
          },
          retryStrategy: (times) => {
            if (times > this.maxRetries) {
              logger.error('❌ Max Redis reconnection attempts reached');
              return null;
            }
            const delay = Math.min(times * this.retryDelay, 30000);
            logger.info(`🔄 Redis reconnect attempt ${times} in ${delay}ms`);
            return delay;
          },
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 10000,
        });

        this.isSentinel = true;
        this.setupEventListeners();
        logger.info('🔌 Connecting to Redis via Sentinel...');

      } 
      // STANDARD CONFIGURATION (existing code)
      else if (redisURI) {
        logger.info('🔌 Connecting to Redis (standard mode)...');
        
        this.client = new Redis(redisURI, {
          retryStrategy: (times) => {
            if (times > this.maxRetries) {
              logger.error('❌ Max Redis reconnection attempts reached');
              return null;
            }
            const delay = Math.min(times * this.retryDelay, 30000);
            logger.info(`🔄 Redis reconnect attempt ${times} in ${delay}ms`);
            return delay;
          },
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 10000,
        });

        this.setupEventListeners();
      }

    } catch (error) {
      this.updateStatus({
        connected: false,
        message: error.message,
        lastError: error.message
      });
      logger.error('❌ Redis connection failed:', error.message);
      throw error;
    }
  }

  getStatus() {
    return {
      ...this.status,
      clientStatus: this.client ? this.client.status : 'not_initialized',
      isCluster: this.isCluster
    };
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis disconnected gracefully');
      } catch (error) {
        logger.error('Error disconnecting Redis:', error.message);
        try {
          this.client.disconnect();
        } catch (e) {
          logger.error('Error force disconnecting Redis:', e.message);
        }
      }
    }
  }

  async ping() {
    if (!this.client || this.client.status !== 'ready') {
      return false;
    }
    
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed:', error.message);
      return false;
    }
  }
}

module.exports = new RedisConnection();