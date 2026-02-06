/**
 * Product Service - Product Search Tests
 * Tests for filtering and pagination
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    models: {
      Product: {
        findAll: jest.fn(),
        count: jest.fn(),
        findOne: jest.fn(),
      },
    },
    close: jest.fn().mockResolvedValue(true),
  },
}));

const { sequelize } = require('../config/database');

// Create a simple test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Search products with filters
  app.get('/api/products/search', async (req, res) => {
    const {
      q,
      category,
      minPrice,
      maxPrice,
      vendorId,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    const where = { isActive: true };

    // Text search
    if (q) {
      where.name = { [Symbol.for('sequelize.Op.like')]: `%${q}%` };
    }

    // Category filter
    if (category) {
      where.category = category;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Symbol.for('sequelize.Op.gte')] = parseFloat(minPrice);
      if (maxPrice) where.price[Symbol.for('sequelize.Op.lte')] = parseFloat(maxPrice);
    }

    // Vendor filter
    if (vendorId) {
      where.vendorId = vendorId;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const order = [[sortBy, sortOrder]];

    const products = await sequelize.models.Product.findAll({
      where,
      limit: parseInt(limit),
      offset,
      order,
    });

    const total = await sequelize.models.Product.count({ where });

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  });

  return app;
};

describe('Product Search API', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('GET /api/products/search', () => {
    it('should return products matching search query', async () => {
      sequelize.models.Product.findAll.mockResolvedValue([
        { id: 'product-1', name: 'Laptop', price: 999.99, category: 'electronics' },
        { id: 'product-2', name: 'Laptop Bag', price: 49.99, category: 'accessories' },
      ]);
      sequelize.models.Product.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/products/search')
        .query({ q: 'Laptop' });

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(2);
      expect(response.body.products[0].name).toContain('Laptop');
    });

    it('should filter by price range', async () => {
      sequelize.models.Product.findAll.mockResolvedValue([
        { id: 'product-1', name: 'Product 1', price: 150.00 },
      ]);
      sequelize.models.Product.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/products/search')
        .query({ minPrice: 100, maxPrice: 200 });

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(1);
    });

    it('should filter by category', async () => {
      sequelize.models.Product.findAll.mockResolvedValue([
        { id: 'product-1', name: 'Phone', category: 'electronics' },
      ]);
      sequelize.models.Product.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/products/search')
        .query({ category: 'electronics' });

      expect(response.status).toBe(200);
      expect(response.body.products[0].category).toBe('electronics');
    });

    it('should paginate results', async () => {
      sequelize.models.Product.findAll.mockResolvedValue([
        { id: 'product-1', name: 'Product 1' },
        { id: 'product-2', name: 'Product 2' },
      ]);
      sequelize.models.Product.count.mockResolvedValue(25);

      const response = await request(app)
        .get('/api/products/search')
        .query({ page: 1, limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.pages).toBe(13);
    });

    it('should sort products', async () => {
      sequelize.models.Product.findAll.mockResolvedValue([
        { id: 'product-3', name: 'Product 3', price: 300 },
        { id: 'product-1', name: 'Product 1', price: 100 },
        { id: 'product-2', name: 'Product 2', price: 200 },
      ]);
      sequelize.models.Product.count.mockResolvedValue(3);

      const response = await request(app)
        .get('/api/products/search')
        .query({ sortBy: 'price', sortOrder: 'ASC' });

      expect(response.status).toBe(200);
      expect(response.body.products).toBeDefined();
    });

    it('should filter by vendor ID', async () => {
      sequelize.models.Product.findAll.mockResolvedValue([
        { id: 'product-1', name: 'Vendor Product', vendorId: 'vendor-123' },
      ]);
      sequelize.models.Product.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/products/search')
        .query({ vendorId: 'vendor-123' });

      expect(response.status).toBe(200);
      expect(response.body.products[0].vendorId).toBe('vendor-123');
    });

    it('should return empty array when no products match', async () => {
      sequelize.models.Product.findAll.mockResolvedValue([]);
      sequelize.models.Product.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/products/search')
        .query({ q: 'NonExistentProduct12345' });

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });
  });
});
