const mongoose = require('mongoose');
const logger = require('../utils/logger');

class MongoDBConnection {
  constructor() {
    this.status = {
      connected: false,
      message: 'Not initialized',
      lastChecked: null,
      connectionAttempts: 0,
      lastError: null,
      topology: null,
      replicaSet: null,
      nodes: []
    };
    
    this.maxRetries = parseInt(process.env.MONGO_MAX_RETRIES) || 10;
    this.retryDelay = parseInt(process.env.MONGO_RETRY_DELAY) || 5000;
    this.currentRetry = 0;
    this.isReconnecting = false;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Connection successful
    mongoose.connection.on('connected', () => {
      this.currentRetry = 0;
      this.isReconnecting = false;
      this.updateStatus({
        connected: true,
        message: 'Connected successfully',
        lastError: null
      });
      this.updateTopology();
      logger.info('✅ MongoDB connected successfully');
    });

    // Connection error
    mongoose.connection.on('error', (err) => {
      this.updateStatus({
        connected: false,
        message: 'Connection error',
        lastError: err.message
      });
      logger.error('❌ MongoDB connection error:', err.message);
    });

    // Disconnected
    mongoose.connection.on('disconnected', () => {
      this.updateStatus({
        connected: false,
        message: 'Disconnected',
        topology: null,
        nodes: []
      });
      logger.warn('⚠️  MongoDB disconnected');
      
      // Attempt reconnection if not already reconnecting
      if (!this.isReconnecting && this.currentRetry < this.maxRetries) {
        this.handleReconnection();
      }
    });

    // Reconnected
    mongoose.connection.on('reconnected', () => {
      this.currentRetry = 0;
      this.isReconnecting = false;
      this.updateStatus({
        connected: true,
        message: 'Reconnected successfully',
        lastError: null
      });
      this.updateTopology();
      logger.info('🔄 MongoDB reconnected');
    });

    // Connection timeout
    mongoose.connection.on('timeout', () => {
      logger.warn('⏱️  MongoDB connection timeout');
    });

    // Replica set events
    mongoose.connection.on('fullsetup', () => {
      logger.info('📦 MongoDB replica set fully connected');
      this.updateTopology();
    });

    mongoose.connection.on('all', () => {
      logger.info('🌐 All MongoDB servers connected');
      this.updateTopology();
    });
  }

  updateStatus(updates) {
    this.status = {
      ...this.status,
      ...updates,
      lastChecked: new Date().toISOString(),
      connectionAttempts: this.status.connectionAttempts + 1
    };
  }

  async updateTopology() {
    try {
      const admin = mongoose.connection.db.admin();
      
      // Get server status
      const serverStatus = await admin.serverStatus();
      
      // Detect topology type
      let topology = 'standalone';
      let replicaSet = null;
      let nodes = [];

      // Check if it's actually a replica set (must have setName)
      if (serverStatus.repl && serverStatus.repl.setName) {
        topology = 'replicaSet';
        replicaSet = serverStatus.repl.setName;
        
        // Get replica set status for detailed member information
        try {
          const replStatus = await admin.command({ replSetGetStatus: 1 });
          
          if (replStatus && replStatus.members) {
            nodes = replStatus.members.map(member => ({
              host: member.name,
              role: member.stateStr === 'PRIMARY' ? 'primary' : 
                    member.stateStr === 'SECONDARY' ? 'secondary' : 
                    member.stateStr.toLowerCase(),
              health: member.health === 1 ? 'healthy' : 'unhealthy',
              state: member.stateStr,
              uptime: member.uptime
            }));
          }
        } catch (replError) {
          // If replSetGetStatus command fails, it's not actually a replica set
          if (replError.codeName === 'NoReplicationEnabled') {
            logger.debug('MongoDB is standalone (no replication enabled)');
            topology = 'standalone';
            replicaSet = null;
          } else {
            logger.error('Error getting replica set status:', replError.message);
          }
        }
      } 
      // Check for sharded cluster
      else if (serverStatus.process === 'mongos') {
        topology = 'sharded';
        
        // Get shard information
        try {
          const shardsInfo = await mongoose.connection.db.admin().command({ listShards: 1 });
          
          if (shardsInfo && shardsInfo.shards) {
            nodes = shardsInfo.shards.map(shard => ({
              host: shard.host,
              role: 'shard',
              name: shard._id,
              state: shard.state === 1 ? 'active' : 'inactive'
            }));
          }
        } catch (shardError) {
          logger.error('Error getting shard info:', shardError.message);
        }
      }

      this.status.topology = topology;
      this.status.replicaSet = replicaSet;
      this.status.nodes = nodes;

      logger.info(`📊 MongoDB topology: ${topology}${replicaSet ? ` (ReplicaSet: ${replicaSet})` : ''}`);

    } catch (error) {
      logger.error('Error detecting MongoDB topology:', error.message);
      // Default to standalone on error
      this.status.topology = 'standalone';
      this.status.replicaSet = null;
      this.status.nodes = [];
    }
  }

  async handleReconnection() {
    if (this.isReconnecting) return;
    
    this.isReconnecting = true;
    this.currentRetry++;

    logger.info(`🔄 Attempting MongoDB reconnection (${this.currentRetry}/${this.maxRetries})...`);

    setTimeout(async () => {
      try {
        if (mongoose.connection.readyState === 0) {
          await this.connect();
        }
        this.isReconnecting = false;
      } catch (error) {
        logger.error(`Reconnection attempt ${this.currentRetry} failed:`, error.message);
        this.isReconnecting = false;
        
        if (this.currentRetry < this.maxRetries) {
          this.handleReconnection();
        } else {
          logger.error('❌ Max reconnection attempts reached for MongoDB');
          this.updateStatus({
            message: 'Max reconnection attempts reached',
            lastError: 'Failed to reconnect after maximum retries'
          });
        }
      }
    }, this.retryDelay * this.currentRetry);
  }

  async connect() {
    const mongoURI = process.env.MONGO_URI || 'mongodb://mongodb:27017/devops-demo';
    
    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      retryReads: true,
      connectTimeoutMS: 10000,
    };

    try {
      logger.info('🔌 Connecting to MongoDB...');
      await mongoose.connect(mongoURI, options);
    } catch (error) {
      this.updateStatus({
        connected: false,
        message: error.message,
        lastError: error.message
      });
      
      logger.error('❌ MongoDB initial connection failed:', error.message);
      
      // Start reconnection attempts
      if (this.currentRetry < this.maxRetries) {
        this.handleReconnection();
      }
      
      throw error;
    }
  }

  getStatus() {
    return {
      ...this.status,
      readyState: mongoose.connection.readyState,
      readyStateLabel: this.getReadyStateLabel(mongoose.connection.readyState)
    };
  }

  getReadyStateLabel(state) {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    return states[state] || 'unknown';
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      logger.info('MongoDB disconnected gracefully');
    } catch (error) {
      logger.error('Error disconnecting MongoDB:', error.message);
    }
  }
}

module.exports = new MongoDBConnection();