import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance with retry logic
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry logic
const axiosRetry = async (config, retryCount = 0) => {
  try {
    return await apiClient.request(config);
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      throw error;
    }

    const shouldRetry = 
      !error.response || // Network error
      error.response.status >= 500 || // Server error
      error.code === 'ECONNABORTED' || // Timeout
      error.code === 'ENOTFOUND' || // DNS error
      error.code === 'ECONNREFUSED'; // Connection refused

    if (shouldRetry) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
      console.log(`Retrying request (${retryCount + 1}/${MAX_RETRIES}) after ${delay}ms...`);
      await sleep(delay);
      return axiosRetry(config, retryCount + 1);
    }

    throw error;
  }
};

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🔵 API Request: ${config.method.toUpperCase()} ${config.url}`);
    config.metadata = { startTime: Date.now() };
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    const duration = Date.now() - response.config.metadata.startTime;
    console.log(`✅ API Response: ${response.status} ${response.config.url} (${duration}ms)`);
    return response;
  },
  (error) => {
    const duration = error.config?.metadata?.startTime 
      ? Date.now() - error.config.metadata.startTime 
      : 0;
    
    console.error(`❌ API Response Error: ${error.message} (${duration}ms)`);
    return Promise.reject(error);
  }
);

// API methods with retry logic
export const fetchBackendStatus = async () => {
  try {
    const response = await axiosRetry({ method: 'GET', url: '/' });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data || null,
      code: error.code,
      statusCode: error.response?.status
    };
  }
};

export const fetchDetailedStatus = async () => {
  try {
    const response = await axiosRetry({ method: 'GET', url: '/status' });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data || null,
      code: error.code,
      statusCode: error.response?.status
    };
  }
};

export const fetchHealthCheck = async () => {
  try {
    const response = await axiosRetry({ method: 'GET', url: '/health' });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data || null,
      code: error.code,
      statusCode: error.response?.status
    };
  }
};

export const fetchArchitecture = async () => {
  try {
    const response = await axiosRetry({ method: 'GET', url: '/architecture' });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data || null,
      code: error.code,
      statusCode: error.response?.status
    };
  }
};

export default apiClient;