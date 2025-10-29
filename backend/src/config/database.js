const mongoose = require('mongoose');
const logger = require('../utils/logger');

let mongoStatus = {
  connected: false,
  message: 'Not initialized',
  lastChecked: null
};

const connectMongoDB = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://mongodb:27017/devops-demo';
  
  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    mongoStatus = {
      connected: true,
      message: 'Connected successfully',
      lastChecked: new Date().toISOString()
    };
    
    logger.info('MongoDB connected successfully');
  } catch (error) {
    mongoStatus = {
      connected: false,
      message: error.message,
      lastChecked: new Date().toISOString()
    };
    
    logger.error('MongoDB connection error:', error.message);
  }
};

// MongoDB connection event listeners
mongoose.connection.on('connected', () => {
  mongoStatus = {
    connected: true,
    message: 'Connected',
    lastChecked: new Date().toISOString()
  };
  logger.info('MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  mongoStatus = {
    connected: false,
    message: err.message,
    lastChecked: new Date().toISOString()
  };
  logger.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  mongoStatus = {
    connected: false,
    message: 'Disconnected',
    lastChecked: new Date().toISOString()
  };
  logger.warn('MongoDB disconnected');
});

const getMongoStatus = () => mongoStatus;

module.exports = { connectMongoDB, getMongoStatus };