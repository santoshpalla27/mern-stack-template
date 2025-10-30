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
    this.isSentinel = false;
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
      // Check if connected to Sentinel
      if (this.isSentinel) {
        const masters = await this.getSentinelMasters();
        this.status.mode = 'sentinel';
        this.status.role = 'sentinel';
        this.status.clusterNodes = masters;
        logger.info(`📊 Redis architecture: sentinel`);
        return;
      }

      // Get Redis INFO
      const info = await this.client.info();
      const infoObj = this.parseRedisInfo(info);

      let mode = 'standalone';
      let role = infoObj.role || 'master';
      let clusterNodes = [];

      // Check if cluster mode
      if (infoObj.cluster_enabled === '1') {
        mode = 'cluster';
        try {
          const clusterInfo = await this.client.sendCommand(['CLUSTER', 'NODES']);
          clusterNodes = this.parseClusterNodes(clusterInfo);
        } catch (error) {
          logger.error('Error getting cluster info:', error.message);
        }
      } 
      else if (role === 'slave') {
        mode = 'replication';
        const masterHost = infoObj.master_host || 'unknown';
        const masterPort = infoObj.master_port || 'unknown';
        
        clusterNodes = [
          {
            role: 'master',
            address: `${masterHost}:${masterPort}`,
            status: infoObj.master_link_status === 'up' ? 'connected' : 'disconnected'
          },
          {
            role: 'slave',
            info: 'current',
            status: 'connected'
          }
        ];
      }
      else if (role === 'master') {
        const connectedSlaves = parseInt(infoObj.connected_slaves) || 0;
        
        if (connectedSlaves > 0) {
          mode = 'replication';
          
          try {
            const replicationInfo = await this.client.info('replication');
            const replObj = this.parseRedisInfo(replicationInfo);
            
            clusterNodes.push({
              role: 'master',
              info: 'current',
              status: 'connected'
            });
            
            for (let i = 0; i < connectedSlaves; i++) {
              const slaveKey = `slave${i}`;
              if (replObj[slaveKey]) {
                const slaveInfo = this.parseSlaveInfo(replObj[slaveKey]);
                clusterNodes.push({
                  role: 'slave',
                  address: `${slaveInfo.ip}:${slaveInfo.port}`,
                  status: slaveInfo.state === 'online' ? 'connected' : 'disconnected',
                  lag: slaveInfo.lag || 0
                });
              }
            }
          } catch (error) {
            logger.error('Error getting replication details:', error.message);
          }
        } else {
          mode = 'standalone';
        }
      }

      this.status.mode = mode;
      this.status.role = role;
      this.status.clusterNodes = clusterNodes;

      logger.info(`📊 Redis architecture: ${mode} (role: ${role})`);

    } catch (error) {
      logger.error('Error getting Redis info:', error.message);
      this.status.mode = 'standalone';
      this.status.role = 'master';
      this.status.clusterNodes = [];
    }
  }

  async checkIfSentinel() {
    try {
      // Try to execute a Sentinel-specific command
      // Sentinel nodes respond to "SENTINEL masters"
      const result = await this.client.sendCommand(['SENTINEL', 'masters']);
      return true; // If this succeeds, it's a Sentinel
    } catch (error) {
      // If command fails, it's not a Sentinel
      if (error.message.includes('unknown command') || 
          error.message.includes('ERR unknown command')) {
        return false;
      }
      // Other errors might still mean it's a sentinel with issues
      logger.debug('Sentinel check error:', error.message);
      return false;
    }
  }

  async getSentinelMasters() {
    try {
      const mastersData = await this.client.sendCommand(['SENTINEL', 'masters']);
      
      const masters = [];
      for (let i = 0; i < mastersData.length; i++) {
        const masterInfo = mastersData[i];
        const master = {};
        
        for (let j = 0; j < masterInfo.length; j += 2) {
          master[masterInfo[j]] = masterInfo[j + 1];
        }
        
        masters.push({
          name: master.name,
          role: 'monitored-master',
          status: master.flags && master.flags.includes('down') ? 'down' : 'up',
          address: `${master.ip}:${master.port}`,
          sentinels: master['num-other-sentinels']
        });
      }
      
      return masters;
    } catch (error) {
      logger.error('Error getting sentinel masters:', error.message);
      return [];
    }
  }

  parseSlaveInfo(slaveStr) {
    // Format: "ip=172.20.0.3,port=6379,state=online,offset=123,lag=0"
    const parts = slaveStr.split(',');
    const info = {};
    
    parts.forEach(part => {
      const [key, value] = part.split('=');
      if (key && value) {
        info[key] = value;
      }
    });
    
    return info;
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
      
      // Check if this is a Sentinel
      this.isSentinel = await this.checkIfSentinel();
      
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
    // Check if Sentinel configuration is provided
    const sentinelHosts = process.env.REDIS_SENTINEL_HOSTS;
    const sentinelMaster = process.env.REDIS_SENTINEL_MASTER || 'mymaster';
    const redisURI = process.env.REDIS_URI;
    
    if (!sentinelHosts && !redisURI) {
      this.updateStatus({
        connected: false,
        message: 'Redis not configured (optional)',
        lastError: null
      });
      logger.info('ℹ️  Redis not configured, skipping connection');
      return;
    }

    let options;

    // ✅ SENTINEL CONFIGURATION
    if (sentinelHosts) {
      logger.info('🔍 Using Redis Sentinel configuration');
      
      // Parse sentinel hosts
      const sentinels = sentinelHosts.split(',').map(host => {
        const [hostname, port] = host.trim().split(':');
        return { host: hostname, port: parseInt(port) || 26379 };
      });

      logger.info(`🔍 Sentinel hosts: ${JSON.stringify(sentinels)}`);
      logger.info(`🔍 Sentinel master name: ${sentinelMaster}`);

      options = {
        socket: {
          connectTimeout: 10000,
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              logger.error('❌ Max Redis reconnection attempts reached');
              return new Error('Max retries reached');
            }
            const delay = Math.min(retries * this.retryDelay, 30000);
            logger.info(`🔄 Redis reconnect attempt ${retries} in ${delay}ms`);
            return delay;
          }
        },
        sentinels: sentinels,
        name: sentinelMaster,
        sentinelRetryStrategy: (retries) => {
          if (retries > 10) {
            logger.error('❌ Max Sentinel retries reached');
            return new Error('Max sentinel retries');
          }
          const delay = Math.min(retries * 1000, 5000);
          logger.info(`🔄 Sentinel retry attempt ${retries} in ${delay}ms`);
          return delay;
        },
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      };

      try {
        logger.info('🔌 Connecting to Redis via Sentinel...');
        this.client = redis.createClient(options);
        this.setupEventListeners();
        await this.client.connect();
        this.isSentinel = true;
      } catch (error) {
        this.updateStatus({
          connected: false,
          message: error.message,
          lastError: error.message
        });
        logger.error('❌ Redis Sentinel connection failed:', error.message);
        throw error;
      }
    } 
    // ✅ STANDARD/CLUSTER CONFIGURATION
    else if (redisURI) {
      options = {
        url: redisURI,
        socket: {
          connectTimeout: 10000,
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              logger.error('❌ Max Redis reconnection attempts reached');
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