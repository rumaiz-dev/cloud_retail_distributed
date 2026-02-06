/**
 * Inventory Service - Inventory Tests
 * Tests for stock updates and reservations
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    models: {
      Inventory: {
        findOne: jest.fn(),
        findByPk: jest.fn(),
        findAll: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        destroy: jest.fn(),
        count: jest.fn(),
      },
    },
    close: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('test-jwt-token'),
  verify: jest.fn().mockReturnValue({ userId: 'test-user-id', role: 'admin' }),
}));

const { sequelize } = require('../config/database');
const jwt = require('jsonwebtoken');

// Create a simple test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

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

  // Get inventory by product ID
  app.get('/api/inventory/:productId', async (req, res) => {
    const inventory = await sequelize.models.Inventory.findOne({
      where: { productId: req.params.productId },
    });

    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    res.json(inventory);
  });

  // Get all inventory with low stock
  app.get('/api/inventory/low-stock/all', authMiddleware, async (req, res) => {
    const inventory = await sequelize.models.Inventory.findAll({
      where: {
        [Symbol.for('sequelize.Op.or')]: [
          { quantity: { [Symbol.for('sequelize.Op.lte')]: sequelize.col('reorderLevel') } },
        ],
      },
    });

    res.json({ inventory });
  });

  // Update stock quantity
  app.put('/api/inventory/:productId/stock', authMiddleware, async (req, res) => {
    const { quantity, operation } = req.body;

    const inventory = await sequelize.models.Inventory.findOne({
      where: { productId: req.params.productId },
    });

    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    let newQuantity = inventory.quantity;
    if (operation === 'add') {
      newQuantity += quantity;
    } else if (operation === 'subtract') {
      newQuantity -= quantity;
    } else {
      newQuantity = quantity;
    }

    await sequelize.models.Inventory.update(
      { quantity: newQuantity },
      { where: { productId: req.params.productId } }
    );

    res.json({ message: 'Stock updated successfully', quantity: newQuantity });
  });

  // Reserve stock for an order
  app.post('/api/inventory/:productId/reserve', authMiddleware, async (req, res) => {
    const { quantity } = req.body;

    const inventory = await sequelize.models.Inventory.findOne({
      where: { productId: req.params.productId },
    });

    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    const availableQuantity = inventory.quantity - inventory.reservedQuantity;
    if (quantity > availableQuantity) {
      return res.status(400).json({ error: 'Insufficient stock available' });
    }

    await sequelize.models.Inventory.update(
      { reservedQuantity: inventory.reservedQuantity + quantity },
      { where: { productId: req.params.productId } }
    );

    res.json({ message: 'Stock reserved successfully', reservedQuantity: inventory.reservedQuantity + quantity });
  });

  // Release reserved stock
  app.post('/api/inventory/:productId/release', authMiddleware, async (req, res) => {
    const { quantity } = req.body;

    const inventory = await sequelize.models.Inventory.findOne({
      where: { productId: req.params.productId },
    });

    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    const releaseQuantity = Math.min(quantity, inventory.reservedQuantity);

    await sequelize.models.Inventory.update(
      { reservedQuantity: inventory.reservedQuantity - releaseQuantity },
      { where: { productId: req.params.productId } }
    );

    res.json({ message: 'Stock released successfully', releasedQuantity: releaseQuantity });
  });

  // Create or update inventory record
  app.post('/api/inventory', authMiddleware, async (req, res) => {
    const { productId, quantity, reorderLevel, reorderQuantity, warehouseLocation } = req.body;

    const existing = await sequelize.models.Inventory.findOne({
      where: { productId },
    });

    if (existing) {
      await sequelize.models.Inventory.update(
        { quantity, reorderLevel, reorderQuantity, warehouseLocation },
        { where: { productId } }
      );
      return res.json({ message: 'Inventory updated successfully' });
    }

    const inventory = await sequelize.models.Inventory.create({
      productId,
      quantity,
      reservedQuantity: 0,
      reorderLevel,
      reorderQuantity,
      warehouseLocation,
    });

    res.status(201).json(inventory);
  });

  return app;
};

describe('Inventory API', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('GET /api/inventory/:productId', () => {
    it('should return inventory for product', async () => {
      sequelize.models.Inventory.findOne.mockResolvedValue({
        productId: 'test-product-id',
        quantity: 100,
        reservedQuantity: 10,
        reorderLevel: 20,
      });

      const response = await request(app)
        .get('/api/inventory/test-product-id');

      expect(response.status).toBe(200);
      expect(response.body.productId).toBe('test-product-id');
      expect(response.body.quantity).toBe(100);
    });

    it('should return 404 for non-existent inventory', async () => {
      sequelize.models.Inventory.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/inventory/non-existent-id');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/inventory/:productId/stock', () => {
    it('should set stock quantity', async () => {
      sequelize.models.Inventory.findOne.mockResolvedValue({
        productId: 'test-product-id',
        quantity: 100,
      });
      sequelize.models.Inventory.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/api/inventory/test-product-id/stock')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ quantity: 150 });

      expect(response.status).toBe(200);
      expect(response.body.quantity).toBe(150);
    });

    it('should add to stock', async () => {
      sequelize.models.Inventory.findOne.mockResolvedValue({
        productId: 'test-product-id',
        quantity: 100,
      });
      sequelize.models.Inventory.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/api/inventory/test-product-id/stock')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ quantity: 50, operation: 'add' });

      expect(response.status).toBe(200);
    });

    it('should subtract from stock', async () => {
      sequelize.models.Inventory.findOne.mockResolvedValue({
        productId: 'test-product-id',
        quantity: 100,
      });
      sequelize.models.Inventory.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/api/inventory/test-product-id/stock')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ quantity: 30, operation: 'subtract' });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/inventory/:productId/reserve', () => {
    it('should reserve stock', async () => {
      sequelize.models.Inventory.findOne.mockResolvedValue({
        productId: 'test-product-id',
        quantity: 100,
        reservedQuantity: 10,
      });
      sequelize.models.Inventory.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/api/inventory/test-product-id/reserve')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ quantity: 20 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Stock reserved successfully');
    });

    it('should reject insufficient stock', async () => {
      sequelize.models.Inventory.findOne.mockResolvedValue({
        productId: 'test-product-id',
        quantity: 100,
        reservedQuantity: 95,
      });

      const response = await request(app)
        .post('/api/inventory/test-product-id/reserve')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ quantity: 10 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Insufficient stock available');
    });
  });

  describe('POST /api/inventory/:productId/release', () => {
    it('should release reserved stock', async () => {
      sequelize.models.Inventory.findOne.mockResolvedValue({
        productId: 'test-product-id',
        quantity: 100,
        reservedQuantity: 20,
      });
      sequelize.models.Inventory.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/api/inventory/test-product-id/release')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ quantity: 10 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Stock released successfully');
    });
  });

  describe('POST /api/inventory', () => {
    it('should create new inventory', async () => {
      sequelize.models.Inventory.findOne.mockResolvedValue(null);
      sequelize.models.Inventory.create.mockResolvedValue({
        id: 'new-inventory-id',
        productId: 'new-product-id',
        quantity: 100,
        reservedQuantity: 0,
        reorderLevel: 20,
      });

      const response = await request(app)
        .post('/api/inventory')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          productId: 'new-product-id',
          quantity: 100,
          reorderLevel: 20,
          reorderQuantity: 50,
          warehouseLocation: 'A1-B2',
        });

      expect(response.status).toBe(201);
    });
  });
});
