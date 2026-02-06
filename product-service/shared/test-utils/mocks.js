/**
 * Redis Mock Helper
 * Provides mock Redis client for unit testing
 */

const EventEmitter = require('events');

// Mock Redis client for testing
class MockRedisClient extends EventEmitter {
  constructor() {
    super();
    this.data = new Map();
    this.expires = new Map();
  }

  async get(key) {
    if (this.expires.has(key) && Date.now() > this.expires.get(key)) {
      this.data.delete(key);
      this.expires.delete(key);
      return null;
    }
    const value = this.data.get(key);
    return value !== undefined ? value : null;
  }

  async set(key, value, mode, duration) {
    this.data.set(key, value);
    if (duration) {
      const ttl = mode === 'EX' ? duration * 1000 : duration;
      this.expires.set(key, Date.now() + ttl);
    }
    return 'OK';
  }

  async del(key) {
    const deleted = this.data.delete(key) ? 1 : 0;
    this.expires.delete(key);
    return deleted;
  }

  async keys(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.data.keys()).filter(key => regex.test(key));
  }

  async flushall() {
    this.data.clear();
    this.expires.clear();
    return 'OK';
  }

  async ping() {
    return 'PONG';
  }

  async setex(key, seconds, value) {
    return this.set(key, value, 'EX', seconds);
  }

  async ttl(key) {
    if (!this.data.has(key)) return -2;
    if (!this.expires.has(key)) return -1;
    const remaining = Math.floor((this.expires.get(key) - Date.now()) / 1000);
    return remaining > 0 ? remaining : -1;
  }

  async incr(key) {
    const current = (this.data.get(key) || 0) + 1;
    this.data.set(key, current);
    return current;
  }

  async decr(key) {
    const current = (this.data.get(key) || 0) - 1;
    this.data.set(key, current);
    return current;
  }

  async hset(key, field, value) {
    const hash = this.data.get(key) || {};
    hash[field] = value;
    this.data.set(key, hash);
    return 1;
  }

  async hget(key, field) {
    const hash = this.data.get(key);
    return hash ? hash[field] : null;
  }

  async hgetall(key) {
    return this.data.get(key) || {};
  }

  async hdel(key, field) {
    const hash = this.data.get(key);
    if (hash) {
      delete hash[field];
      this.data.set(key, hash);
      return 1;
    }
    return 0;
  }

  async lpush(key, ...values) {
    const list = this.data.get(key) || [];
    this.data.set(key, [...values, ...list]);
    return this.data.get(key).length;
  }

  async lrange(key, start, stop) {
    const list = this.data.get(key) || [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  async publish(channel, message) {
    this.emit('message', channel, message);
    return 1;
  }

  async subscribe(channel) {
    this.emit('subscribe', channel);
  }

  async unsubscribe(channel) {
    this.emit('unsubscribe', channel);
  }

  async quit() {
    return 'OK';
  }

  async disconnect() {
    return 'OK';
  }

  reset() {
    this.data.clear();
    this.expires.clear();
  }
}

// Create a new mock Redis client
const createMockRedisClient = () => {
  return new MockRedisClient();
};

// Mock Redis connection
const mockRedisConnection = () => ({
  createClient: jest.fn(() => createMockRedisClient()),
});

module.exports = {
  MockRedisClient,
  createMockRedisClient,
  mockRedisConnection,
};
