const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class HttpClient {
  constructor(baseUrl, serviceName) {
    this.baseUrl = baseUrl;
    this.serviceName = serviceName;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging and tracing
    this.client.interceptors.request.use(
      (config) => {
        const requestId = uuidv4();
        config.headers['X-Request-ID'] = requestId;
        logger.debug(`[${this.serviceName}] Request:`, {
          method: config.method,
          url: config.url,
          requestId
        });
        return config;
      },
      (error) => {
        logger.error(`[${this.serviceName}] Request error:`, error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`[${this.serviceName}] Response:`, {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        const requestId = error.config?.headers?.['X-Request-ID'] || 'unknown';
        logger.error(`[${this.serviceName}] Response error:`, {
          message: error.message,
          status: error.response?.status,
          url: error.config?.url,
          requestId
        });
        return Promise.reject(error);
      }
    );
  }

  async get(url, options = {}) {
    try {
      const response = await this.client.get(url, options);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      const errorStatus = error.response?.status || 500;
      
      const customError = new Error(errorMessage);
      customError.statusCode = errorStatus;
      customError.service = this.serviceName;
      customError.endpoint = url;
      
      throw customError;
    }
  }

  async post(url, data, options = {}) {
    try {
      const response = await this.client.post(url, data, options);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      const errorStatus = error.response?.status || 500;
      
      const customError = new Error(errorMessage);
      customError.statusCode = errorStatus;
      customError.service = this.serviceName;
      customError.endpoint = url;
      
      throw customError;
    }
  }
}

module.exports = HttpClient;
