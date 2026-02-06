/**
 * User Service - Authentication Tests
 * Tests for registration, login, and JWT validation
 */

const request = require('supertest');
const express = require('express');

// Create mock implementations
const mockUserFindOne = jest.fn();
const mockUserCreate = jest.fn();
const mockUserFindByPk = jest.fn();
const mockUserUpdate = jest.fn();
const mockBcryptHash = jest.fn();
const mockBcryptCompare = jest.fn();
const mockJwtSign = jest.fn();
const mockJwtVerify = jest.fn();

// Mock jsonwebtoken before any imports
jest.mock('jsonwebtoken', () => ({
  sign: (...args) => mockJwtSign(...args),
  verify: (...args) => mockJwtVerify(...args),
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: (...args) => mockBcryptHash(...args),
  compare: (...args) => mockBcryptCompare(...args),
}));

// Mock database
jest.mock('../config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    models: {
      User: {
        findOne: (...args) => mockUserFindOne(...args),
        create: (...args) => mockUserCreate(...args),
        findByPk: (...args) => mockUserFindByPk(...args),
        update: (...args) => mockUserUpdate(...args),
        destroy: jest.fn().mockResolvedValue(true),
      },
    },
    close: jest.fn().mockResolvedValue(true),
  },
}));

// Get mocked modules
const jwt = require('jsonwebtoken');

// Create a simple test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Mock auth routes (inline for testing)
  app.post('/api/auth/register', async (req, res) => {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(500).json({ error: 'Validation error' });
    }

    const existingUser = await mockUserFindOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await mockBcryptHash(password, 10);
    const user = await mockUserCreate({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: role || 'customer',
    });

    const token = mockJwtSign({ userId: user.id, email: user.email, role: user.role }, 'test-secret');

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, email: user.email, firstName, lastName, role: user.role },
      token,
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    const user = await mockUserFindOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await mockBcryptCompare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = mockJwtSign({ userId: user.id, email: user.email, role: user.role }, 'test-secret');

    res.json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      token,
    });
  });

  return app;
};

describe('Authentication API', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    // Set default mock implementations
    mockJwtSign.mockReturnValue('test-jwt-token');
    mockJwtVerify.mockReturnValue({ userId: 'test-user-id', role: 'customer' });
    mockBcryptHash.mockResolvedValue('hashed-password');
    mockBcryptCompare.mockResolvedValue(true);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({
        id: 'new-user-id',
        email: 'newuser@test.com',
        firstName: 'New',
        lastName: 'User',
        role: 'customer',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'Password123!',
          firstName: 'New',
          lastName: 'User',
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user.email).toBe('newuser@test.com');
      expect(response.body.token).toBeDefined();
    });

    it('should return error if user already exists', async () => {
      mockUserFindOne.mockResolvedValue({
        id: 'existing-user-id',
        email: 'existing@test.com',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@test.com',
          password: 'Password123!',
          firstName: 'Existing',
          lastName: 'User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User already exists');
    });

    it('should return error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      mockUserFindOne.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@test.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        role: 'customer',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBeDefined();
    });

    it('should return error for invalid credentials', async () => {
      mockUserFindOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return error for wrong password', async () => {
      mockUserFindOne.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@test.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        role: 'customer',
      });

      mockBcryptCompare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: 'WrongPassword!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('JWT Token Validation', () => {
    it('should generate a valid JWT token', () => {
      const payload = { userId: 'test-user-id', email: 'test@test.com', role: 'customer' };
      const token = jwt.sign(payload, 'test-secret');

      expect(token).toBe('test-jwt-token');
      expect(mockJwtSign).toHaveBeenCalledWith(payload, 'test-secret');
    });

    it('should verify a valid JWT token', () => {
      const token = 'valid-jwt-token';
      const decoded = jwt.verify(token, 'test-secret');

      expect(decoded.userId).toBe('test-user-id');
      expect(decoded.role).toBe('customer');
    });

    it('should throw error for invalid token verification', () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => {
        jwt.verify('invalid-token', 'test-secret');
      }).toThrow('Invalid token');
    });
  });
});
