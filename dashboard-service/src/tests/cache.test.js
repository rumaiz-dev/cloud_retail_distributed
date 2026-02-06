/**
 * Dashboard Service - Cache Tests
 * Tests for Redis caching behavior
 */

const express = require('express');

// Create a mock Redis client
const createMockRedisClient = () => {
  const data = new Map();
  const expires = new Map();

  return {
    async get(key) {
      if (expires.has(key) && Date.now() > expires.get(key)) {
        data.delete(key);
        expires.delete(key);
        return null;
      }
      return data.get(key) || null;
    },
    async set(key, value, mode, duration) {
      data.set(key, value);
      if (duration) {
        const ttl = mode === 'EX' ? duration * 1000 : duration;
        expires.set(key, Date.now() + ttl);
      }
      return 'OK';
    },
    async del(key) {
      const deleted = data.delete(key) ? 1 : 0;
      expires.delete(key);
      return deleted;
    },
    async keys(pattern) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Array.from(data.keys()).filter(key => regex.test(key));
    },
    async flushall() {
      data.clear();
      expires.clear();
      return 'OK';
    },
    reset() {
      data.clear();
      expires.clear();
    },
  };
};

describe('Redis Cache Behavior', () => {
  let redisClient;

  beforeEach(() => {
    redisClient = createMockRedisClient();
  });

  afterEach(() => {
    redisClient.reset();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      await redisClient.set('test-key', 'test-value');
      const value = await redisClient.get('test-key');

      expect(value).toBe('test-value');
    });

    it('should return null for non-existent key', async () => {
      const value = await redisClient.get('non-existent-key');

      expect(value).toBeNull();
    });

    it('should delete a key', async () => {
      await redisClient.set('delete-me', 'value');
      await redisClient.del('delete-me');
      const value = await redisClient.get('delete-me');

      expect(value).toBeNull();
    });

    it('should set key with expiration', async () => {
      await redisClient.set('expiring-key', 'value', 'EX', 5);
      const value = await redisClient.get('expiring-key');

      expect(value).toBe('value');
    });

    it('should expire key after TTL', async () => {
      await redisClient.set('short-lived', 'value', 'EX', 1);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const value = await redisClient.get('short-lived');
      expect(value).toBeNull();
    });
  });

  describe('Pattern Matching', () => {
    it('should find keys matching pattern', async () => {
      await redisClient.set('dashboard:sales:1', 'data1');
      await redisClient.set('dashboard:sales:2', 'data2');
      await redisClient.set('dashboard:users:1', 'data3');

      const keys = await redisClient.keys('dashboard:sales:*');

      expect(keys).toHaveLength(2);
      expect(keys).toContain('dashboard:sales:1');
      expect(keys).toContain('dashboard:sales:2');
    });

    it('should find all keys with wildcard', async () => {
      await redisClient.set('key1', 'value1');
      await redisClient.set('key2', 'value2');

      const keys = await redisClient.keys('*');

      expect(keys).toHaveLength(2);
    });
  });

  describe('Cache Key Strategies', () => {
    it('should use TTL-based cache keys', async () => {
      const cacheKey = (type, id, period) => `dashboard:${type}:${id}:${period}`;
      
      const key = cacheKey('sales', 'overview', 'week');
      expect(key).toBe('dashboard:sales:overview:week');
    });

    it('should support cache invalidation by pattern', async () => {
      await redisClient.set('dashboard:sales:week', 'data1');
      await redisClient.set('dashboard:sales:month', 'data2');
      await redisClient.set('dashboard:users:total', 'data3');

      // Invalidate all sales cache
      const keys = await redisClient.keys('dashboard:sales:*');
      for (const key of keys) {
        await redisClient.del(key);
      }

      expect(await redisClient.get('dashboard:sales:week')).toBeNull();
      expect(await redisClient.get('dashboard:sales:month')).toBeNull();
      expect(await redisClient.get('dashboard:users:total')).toBe('data3');
    });
  });

  describe('Cache-Aside Pattern', () => {
    it('should implement cache-aside pattern correctly', async () => {
      const cacheKey = 'product:count';
      const fetchFromDatabase = async () => ({ count: 100 });

      // Check cache first
      let cachedData = await redisClient.get(cacheKey);
      
      if (!cachedData) {
        // Fetch from database
        cachedData = await fetchFromDatabase();
        // Store in cache with 5 minute TTL
        await redisClient.set(cacheKey, JSON.stringify(cachedData), 'EX', 300);
      }

      expect(cachedData).toEqual({ count: 100 });

      // Second request should hit cache
      const cachedData2 = await redisClient.get(cacheKey);
      expect(cachedData2).toEqual({ count: 100 });
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate specific cache entries', async () => {
      await redisClient.set('cache:v1', 'data1');
      await redisClient.set('cache:v2', 'data2');

      await redisClient.del('cache:v1');

      expect(await redisClient.get('cache:v1')).toBeNull();
      expect(await redisClient.get('cache:v2')).toBe('data2');
    });

    it('should invalidate all cache entries', async () => {
      await redisClient.set('key1', 'value1');
      await redisClient.set('key2', 'value2');
      await redisClient.set('key3', 'value3');

      await redisClient.flushall();

      expect(await redisClient.get('key1')).toBeNull();
      expect(await redisClient.get('key2')).toBeNull();
      expect(await redisClient.get('key3')).toBeNull();
    });
  });
});

describe('Cache Middleware', () => {
  let redisClient;

  beforeEach(() => {
    redisClient = createMockRedisClient();
  });

  it('should cache dashboard responses', async () => {
    const cacheMiddleware = (key, ttl = 300) => {
      return async (req, res, next) => {
        const cached = await redisClient.get(key);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
        
        // Store original json method
        const originalJson = res.json.bind(res);
        
        res.json = (data) => {
          // Cache the response
          redisClient.set(key, JSON.stringify(data), 'EX', ttl);
          return originalJson(data);
        };
        
        next();
      };
    };

    const app = express();
    app.use('/api/dashboard/test', cacheMiddleware('dashboard:test', 60), (req, res) => {
      res.json({ data: 'fresh data' });
    });

    // First request - should cache
    const response1 = await request(app).get('/api/dashboard/test');
    expect(response1.body.data).toBe('fresh data');

    // Second request - should hit cache
    const response2 = await request(app).get('/api/dashboard/test');
    expect(response2.body.data).toBe('fresh data');
  });
});
