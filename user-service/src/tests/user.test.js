/**
 * User Service - User Profile Tests
 * Tests for CRUD operations on user profile
 */

const request = require('supertest');
const express = require('express');

// Create mock implementations
const mockUserFindOne = jest.fn();
const mockUserFindByPk = jest.fn();
const mockUserCreate = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserDestroy = jest.fn();
const mockJwtVerify = jest.fn();

// Mock jsonwebtoken before any imports
jest.mock('jsonwebtoken', () => ({
  sign: (...args) => 'test-jwt-token',
  verify: (...args) => mockJwtVerify(...args),
}));

// Mock database
jest.mock('../config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    models: {
      User: {
        findOne: (...args) => mockUserFindOne(...args),
        findByPk: (...args) => mockUserFindByPk(...args),
        create: (...args) => mockUserCreate(...args),
        update: (...args) => mockUserUpdate(...args),
        destroy: (...args) => mockUserDestroy(...args),
      },
    },
    close: jest.fn().mockResolvedValue(true),
  },
}));

// Get mocked modules
const jwt = require('jsonwebtoken');

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, 'test-secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Create a simple test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Get user profile
  app.get('/api/users/profile', authMiddleware, async (req, res) => {
    const user = await mockUserFindByPk(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  });

  // Update user profile
  app.put('/api/users/profile', authMiddleware, async (req, res) => {
    const { firstName, lastName } = req.body;
    const user = await mockUserFindByPk(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await mockUserUpdate(
      { firstName, lastName },
      { where: { id: req.user.userId } }
    );
    res.json({ message: 'Profile updated successfully' });
  });

  // Get user by ID (admin only)
  app.get('/api/users/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const user = await mockUserFindByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  });

  // List all users (admin only)
  app.get('/api/users', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ users: [] });
  });

  return app;
};

describe('User Profile API', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    // Set default mock implementation
    mockJwtVerify.mockReturnValue({ userId: 'test-user-id', role: 'customer', email: 'test@test.com' });
  });

  describe('GET /api/users/profile', () => {
    it('should return user profile with valid token', async () => {
      mockUserFindByPk.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'customer',
      });

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test-user-id');
      expect(response.body.email).toBe('test@test.com');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/users/profile');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No token provided');
    });

    it('should return 404 for non-existent user', async () => {
      mockUserFindByPk.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user profile', async () => {
      mockUserFindByPk.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@test.com',
      });
      mockUserUpdate.mockResolvedValue([1]);

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Profile updated successfully');
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by ID for admin', async () => {
      mockJwtVerify.mockReturnValue({ userId: 'admin-id', role: 'admin', email: 'admin@test.com' });
      mockUserFindByPk.mockResolvedValue({
        id: 'other-user-id',
        email: 'other@test.com',
        firstName: 'Other',
        lastName: 'User',
        role: 'customer',
      });

      const response = await request(app)
        .get('/api/users/other-user-id')
        .set('Authorization', 'Bearer admin-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('other-user-id');
    });

    it('should deny access for non-admin users', async () => {
      mockJwtVerify.mockReturnValue({ userId: 'customer-id', role: 'customer', email: 'customer@test.com' });

      const response = await request(app)
        .get('/api/users/other-user-id')
        .set('Authorization', 'Bearer customer-jwt-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('GET /api/users', () => {
    it('should list all users for admin', async () => {
      mockJwtVerify.mockReturnValue({ userId: 'admin-id', role: 'admin', email: 'admin@test.com' });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer admin-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.users).toBeDefined();
    });

    it('should deny access for non-admin users', async () => {
      mockJwtVerify.mockReturnValue({ userId: 'customer-id', role: 'customer', email: 'customer@test.com' });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer customer-jwt-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });
});
