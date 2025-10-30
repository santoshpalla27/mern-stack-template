const redis = require('redis');
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
    
    this.maxRetries = parseInt(process.env.REDIS_MAX_RETRIES) || 10;
    this.retryDelay = parseInt(process.env.REDIS_RETRY_DELAY) || 5000;
    this.currentRetry = 0;
    this.isReconnecting = false;
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
    if (!this.client || !this.client.isOpen) return;

    try {
      // Get Redis INFO
      const info = await this.client.info();
      const infoObj = this.parseRedisInfo(info);

      // Determine mode
      let mode = 'standalone';
      let role = infoObj.role || 'master';
      let clusterNodes = [];

      // Check if cluster mode (highest priority)
      if (infoObj.cluster_enabled === '1') {
        mode = 'cluster';
        try {
          const clusterInfo = await this.client.sendCommand(['CLUSTER', 'NODES']);
          clusterNodes = this.parseClusterNodes(clusterInfo);
        } catch (error) {
          logger.error('Error getting cluster info:', error.message);
        }
      } 
      // Check if it's actually in replication (has slaves or is a slave)
      else if (role === 'slave') {
        // This node is a slave, so it's definitely replication
        mode = 'replication';
      }
      else if (role === 'master') {
        // Check if this master actually has connected slaves
        const connectedSlaves = parseInt(infoObj.connected_slaves) || 0;
        
        if (connectedSlaves > 0) {
          mode = 'replication';
          
          // Get slave information
          try {
            const replicationInfo = await this.client.info('replication');
            const replObj = this.parseRedisInfo(replicationInfo);
            
            // Parse slave information
            for (let i = 0; i < connectedSlaves; i++) {
              const slaveKey = `slave${i}`;
              if (replObj[slaveKey]) {
                clusterNodes.push({
                  role: 'slave',
                  info: replObj[slaveKey]
                });
              }
            }
            
            // Add master info
            clusterNodes.unshift({
              role: 'master',
              info: 'current'
            });
          } catch (error) {
            logger.error('Error getting replication details:', error.message);
          }
        } else {
          // Master with no slaves = standalone
          mode = 'standalone';
        }
      }
      
      // Check for Sentinel (this would require connecting to sentinel, not data node)
      // Sentinel detection happens when connecting to sentinel port (26379)
      if (infoObj.redis_mode === 'sentinel') {
        mode = 'sentinel';
      }

      this.status.mode = mode;
      this.status.role = role;
      this.status.clusterNodes = clusterNodes;

      logger.info(`📊 Redis architecture: ${mode} (role: ${role})`);

    } catch (error) {
      logger.error('Error getting Redis info:', error.message);
      // Default to standalone on error
      this.status.mode = 'standalone';
      this.status.role = 'master';
      this.status.clusterNodes = [];
    }
  }

  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const result = {};
    
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  parseClusterNodes(nodesStr) {
    const lines = nodesStr.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const parts = line.split(' ');
      return {
        id: parts[0],
        address: parts[1],
        flags: parts[2],
        role: parts[2].includes('master') ? 'master' : 'slave',
        status: parts[7] === 'connected' ? 'connected' : 'disconnected'
      };
    });
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

    this.client.on('end', () => {
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
    const redisURI = process.env.REDIS_URI;
    
    if (!redisURI) {
      this.updateStatus({
        connected: false,
        message: 'Redis not configured (optional)',
        lastError: null
      });
      logger.info('ℹ️  Redis URI not provided, skipping connection');
      return;
    }

    const options = {
      url: redisURI,
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => {
          if (retries > this.maxRetries) {
            logger.error('❌ Max Redis reconnection attempts reached');
            this.updateStatus({
              message: 'Max reconnection attempts reached',
              lastError: 'Failed to reconnect after maximum retries'
            });
            return new Error('Max retries reached');
          }
          
          const delay = Math.min(retries * this.retryDelay, 30000);
          logger.info(`🔄 Redis reconnect attempt ${retries} in ${delay}ms`);
          return delay;
        }
      },
      enableReadyCheck: true,
      maxRetriesPerRequest: 3
    };

    try {
      logger.info('🔌 Connecting to Redis...');
      this.client = redis.createClient(options);
      this.setupEventListeners();
      await this.client.connect();
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
    return this.status;
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis disconnected gracefully');
      } catch (error) {
        logger.error('Error disconnecting Redis:', error.message);
        try {
          await this.client.disconnect();
        } catch (e) {
          logger.error('Error force disconnecting Redis:', e.message);
        }
      }
    }
  }

  async ping() {
    if (!this.client || !this.client.isOpen) {
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