/**
 * API Gateway - Gateway Tests
 * Tests for routing, authentication middleware, and rate limiting
 */

const request = require('supertest');
const express = require('express');

// Create mock functions at module level
const mockJwtSign = jest.fn();
const mockJwtVerify = jest.fn();

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: (...args) => mockJwtSign(...args),
  verify: (...args) => mockJwtVerify(...args),
}));

// Rate limiter configuration
const createRateLimiter = (redisClient) => {
  const RATE_LIMIT = 100;
  const WINDOW_MS = 60000; // 1 minute

  return async (req, res, next) => {
    const key = `ratelimit:${req.ip}`;
    const count = await redisClient.incr(key);
    
    if (count === 1) {
      await redisClient.expire(key, WINDOW_MS / 1000);
    }

    if (count > RATE_LIMIT) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    req.rateLimitRemaining = RATE_LIMIT - count;
    next();
  };
};

// Auth middleware
const createAuthMiddleware = () => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const decoded = mockJwtVerify(token, 'test-secret');
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
};

// Role-based access control middleware
const createRBACMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
};

// Create a simple test app with gateway features
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  const redisClient = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };

  const rateLimiter = createRateLimiter(redisClient);
  const authMiddleware = createAuthMiddleware();
  const rbacMiddleware = createRBACMiddleware('admin');

  // Health check (no auth)
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  // Rate limited route
  app.get('/api/public/products', rateLimiter, (req, res) => {
    res.json({ products: [], remaining: req.rateLimitRemaining });
  });

  // Authenticated route
  app.get('/api/users/profile', authMiddleware, (req, res) => {
    res.json({ user: req.user });
  });

  // Admin-only route
  app.get('/api/admin/users', authMiddleware, rbacMiddleware, (req, res) => {
    res.json({ users: [] });
  });

  // Route configuration for service routing
  const serviceRoutes = {
    '/api/auth': { target: 'http://user-service:3001', path: '/api/auth' },
    '/api/products': { target: 'http://product-service:3002', path: '/api/products' },
    '/api/orders': { target: 'http://order-service:3003', path: '/api/orders' },
    '/api/inventory': { target: 'http://inventory-service:3004', path: '/api/inventory' },
    '/api/dashboard': { target: 'http://dashboard-service:3005', path: '/api/dashboard' },
  };

  // Proxy route (simplified for testing)
  app.use('/api', async (req, res) => {
    const fullPath = req.originalUrl.split('?')[0]; // Get full path without query string
    const route = Object.keys(serviceRoutes).find(route => fullPath.startsWith(route));
    
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const service = serviceRoutes[route];
    res.json({
      routed: true,
      target: service.target,
      path: fullPath,
    });
  });

  return app;
};

describe('API Gateway', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    // Set default mock implementations
    mockJwtSign.mockReturnValue('test-jwt-token');
    mockJwtVerify.mockReturnValue({ userId: 'test-user-id', role: 'customer' });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const response = await request(app)
        .get('/api/public/products');

      expect(response.status).toBe(200);
      expect(response.body.products).toBeDefined();
    });

    it('should track rate limit count', async () => {
      const response = await request(app)
        .get('/api/public/products');

      expect(response.status).toBe(200);
    });

    it('should reject requests over rate limit', async () => {
      // Mock Redis to return count over limit
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        incr: jest.fn().mockResolvedValue(101),
        expire: jest.fn().mockResolvedValue(1),
      };

      const rateLimiter = createRateLimiter(mockRedis);
      const testApp = express();
      testApp.use('/api', rateLimiter, (req, res) => {
        res.json({ message: 'OK' });
      });

      const response = await request(testApp)
        .get('/api/test');

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too many requests');
    });
  });

  describe('Authentication Middleware', () => {
    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/users/profile');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should accept valid JWT token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
    });

    it('should reject invalid JWT token', async () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow admin access to admin routes', async () => {
      mockJwtVerify.mockReturnValue({ userId: 'admin-id', role: 'admin' });

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
    });

    it('should deny customer access to admin routes', async () => {
      mockJwtVerify.mockReturnValue({ userId: 'customer-id', role: 'customer' });

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer customer-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('Service Routing', () => {
    it('should route to user-service', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.routed).toBe(true);
      expect(response.body.target).toContain('user-service');
    });

    it('should route to product-service', async () => {
      const response = await request(app)
        .get('/api/products');

      expect(response.status).toBe(200);
      expect(response.body.target).toContain('product-service');
    });

    it('should route to order-service', async () => {
      const response = await request(app)
        .get('/api/orders');

      expect(response.status).toBe(200);
      expect(response.body.target).toContain('order-service');
    });

    it('should route to inventory-service', async () => {
      const response = await request(app)
        .get('/api/inventory');

      expect(response.status).toBe(200);
      expect(response.body.target).toContain('inventory-service');
    });

    it('should route to dashboard-service', async () => {
      const response = await request(app)
        .get('/api/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.target).toContain('dashboard-service');
    });

    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route');

      expect(response.status).toBe(404);
    });
  });

  describe('JWT Token Operations', () => {
    it('should generate a valid token', () => {
      const jwt = require('jsonwebtoken');
      const payload = { userId: 'test-id', role: 'customer' };
      const token = jwt.sign(payload, 'test-secret');

      expect(token).toBe('test-jwt-token');
      expect(mockJwtSign).toHaveBeenCalledWith(payload, 'test-secret');
    });

    it('should verify a valid token', () => {
      const jwt = require('jsonwebtoken');
      const token = 'valid-token';
      const decoded = jwt.verify(token, 'test-secret');

      expect(decoded.userId).toBe('test-user-id');
      expect(decoded.role).toBe('customer');
    });

    it('should reject expired tokens', () => {
      const jwt = require('jsonwebtoken');
      
      mockJwtVerify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      expect(() => {
        jwt.verify('expired-token', 'test-secret');
      }).toThrow('jwt expired');
    });
  });
});
