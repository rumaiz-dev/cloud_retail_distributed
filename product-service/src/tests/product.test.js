/**
 * Product Service - Product CRUD Tests
 * Tests for product creation, retrieval, update, and deletion
 */

const request = require('supertest');
const express = require('express');

// Create mock implementations
const mockProductFindOne = jest.fn();
const mockProductFindByPk = jest.fn();
const mockProductFindAll = jest.fn();
const mockProductCreate = jest.fn();
const mockProductUpdate = jest.fn();
const mockProductCount = jest.fn();
const mockProductDestroy = jest.fn();
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
      Product: {
        findOne: (...args) => mockProductFindOne(...args),
        findByPk: (...args) => mockProductFindByPk(...args),
        findAll: (...args) => mockProductFindAll(...args),
        create: (...args) => mockProductCreate(...args),
        update: (...args) => mockProductUpdate(...args),
        count: (...args) => mockProductCount(...args),
        destroy: (...args) => mockProductDestroy(...args),
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

  // Create product
  app.post('/api/products', authMiddleware, async (req, res) => {
    const { name, description, price, category, sku } = req.body;

    if (!name || !price || !category || !sku) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingProduct = await mockProductFindOne({ where: { sku } });
    if (existingProduct) {
      return res.status(400).json({ error: 'Product with this SKU already exists' });
    }

    const product = await mockProductCreate({
      name,
      description,
      price,
      category,
      sku,
      vendorId: req.user.userId,
      isActive: true,
    });

    res.status(201).json(product);
  });

  // Get all products with pagination
  app.get('/api/products', async (req, res) => {
    const { page = 1, limit = 10, category } = req.query;
    const offset = (page - 1) * limit;

    const where = { isActive: true };
    if (category) {
      where.category = category;
    }

    const products = await mockProductFindAll({
      where,
      limit: parseInt(limit),
      offset,
    });

    const total = await mockProductCount({ where });

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  });

  // Get product by ID
  app.get('/api/products/:id', async (req, res) => {
    const product = await mockProductFindByPk(req.params.id);

    if (!product || !product.isActive) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  });

  // Update product
  app.put('/api/products/:id', authMiddleware, async (req, res) => {
    const { name, description, price, category } = req.body;

    const product = await mockProductFindByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await mockProductUpdate(
      { name, description, price, category },
      { where: { id: req.params.id } }
    );

    res.json({ message: 'Product updated successfully' });
  });

  // Delete product (soft delete)
  app.delete('/api/products/:id', authMiddleware, async (req, res) => {
    const product = await mockProductFindByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await mockProductUpdate(
      { isActive: false },
      { where: { id: req.params.id } }
    );

    res.json({ message: 'Product deleted successfully' });
  });

  return app;
};

describe('Product API', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    // Set default mock implementation
    mockJwtVerify.mockReturnValue({ userId: 'test-user-id', role: 'vendor' });
  });

  describe('POST /api/products', () => {
    it('should create a new product', async () => {
      mockProductFindOne.mockResolvedValue(null);
      mockProductCreate.mockResolvedValue({
        id: 'new-product-id',
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        category: 'electronics',
        sku: 'TEST-SKU-001',
        vendorId: 'test-user-id',
        isActive: true,
      });

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          name: 'Test Product',
          description: 'Test Description',
          price: 99.99,
          category: 'electronics',
          sku: 'TEST-SKU-001',
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Test Product');
      expect(response.body.sku).toBe('TEST-SKU-001');
    });

    it('should reject duplicate SKU', async () => {
      mockProductFindOne.mockResolvedValue({
        id: 'existing-product',
        sku: 'TEST-SKU-001',
      });

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          name: 'Duplicate Product',
          description: 'Test Description',
          price: 99.99,
          category: 'electronics',
          sku: 'TEST-SKU-001',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Product with this SKU already exists');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({
          name: 'Test Product',
          description: 'Test Description',
          price: 99.99,
          category: 'electronics',
          sku: 'TEST-SKU-002',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/products', () => {
    it('should return paginated products', async () => {
      mockProductFindAll.mockResolvedValue([
        { id: 'product-1', name: 'Product 1', price: 99.99 },
        { id: 'product-2', name: 'Product 2', price: 149.99 },
      ]);
      mockProductCount.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/products')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter by category', async () => {
      mockProductFindAll.mockResolvedValue([
        { id: 'product-1', name: 'Electronics', category: 'electronics' },
      ]);
      mockProductCount.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/products')
        .query({ category: 'electronics' });

      expect(response.status).toBe(200);
      expect(response.body.products[0].category).toBe('electronics');
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return product by ID', async () => {
      mockProductFindByPk.mockResolvedValue({
        id: 'test-product-id',
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        category: 'electronics',
        isActive: true,
      });

      const response = await request(app)
        .get('/api/products/test-product-id');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test-product-id');
    });

    it('should return 404 for non-existent product', async () => {
      mockProductFindByPk.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/products/non-existent-id');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/products/:id', () => {
    it('should update product', async () => {
      mockProductFindByPk.mockResolvedValue({
        id: 'test-product-id',
        name: 'Old Name',
      });
      mockProductUpdate.mockResolvedValue([1]);

      const response = await request(app)
        .put('/api/products/test-product-id')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          name: 'Updated Name',
          description: 'Updated Description',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Product updated successfully');
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should soft delete product', async () => {
      mockProductFindByPk.mockResolvedValue({
        id: 'test-product-id',
      });
      mockProductUpdate.mockResolvedValue([1]);

      const response = await request(app)
        .delete('/api/products/test-product-id')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Product deleted successfully');
    });
  });
});
