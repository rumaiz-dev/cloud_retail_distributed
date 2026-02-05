const redis = require('redis');
const logger = require('../utils/logger');

class CacheClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.isConfigured = false;
  }

  async connect() {
    const redisHost = process.env.REDIS_HOST;
    const redisPort = process.env.REDIS_PORT;

    // If Redis is not configured, skip connection
    if (!redisHost || !redisPort || redisHost.trim() === '' || redisPort.trim() === '') {
      logger.info('Redis not configured, caching disabled');
      this.isConfigured = false;
      return null;
    }

    this.isConfigured = true;

    try {
      const host = redisHost;
      const port = parseInt(redisPort) || 6379;
      const password = process.env.REDIS_PASSWORD || undefined;

      this.client = redis.createClient({
        socket: {
          host,
          port
        },
        password: password || undefined
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error.message);
      this.isConnected = false;
      return null;
    }
  }

  async get(key) {
    try {
      if (!this.isConfigured || !this.isConnected || !this.client) {
        return null;
      }
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error.message);
      return null;
    }
  }

  async set(key, value, ttl = 60) {
    try {
      if (!this.isConfigured || !this.isConnected || !this.client) {
        return false;
      }
      await this.client.set(key, JSON.stringify(value), {
        EX: ttl
      });
      return true;
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error.message);
      return false;
    }
  }

  async delete(key) {
    try {
      if (!this.isConfigured || !this.isConnected || !this.client) {
        return false;
      }
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis delete error for key ${key}:`, error.message);
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
        }
        await this.client.quit();
        this.isConnected = false;
      }
    } catch (error) {
      logger.error('Redis disconnect error:', error.message);
    }
  }

  async isHealthy() {
    return this.isConnected;
  }
}

module.exports = new CacheClient();
