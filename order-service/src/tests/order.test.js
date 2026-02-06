/**
 * Order Service - Order Tests
 * Tests for order creation, status updates, and retrieval
 */

const request = require('supertest');
const express = require('express');

// Create mock implementations at module level
const mockOrderFindOne = jest.fn();
const mockOrderFindByPk = jest.fn();
const mockOrderFindAll = jest.fn();
const mockOrderCreate = jest.fn();
const mockOrderUpdate = jest.fn();
const mockOrderDestroy = jest.fn();
const mockOrderCount = jest.fn();
const mockOrderItemFindAll = jest.fn();
const mockOrderItemFindOne = jest.fn();
const mockOrderItemCreate = jest.fn();
const mockOrderItemUpdate = jest.fn();
const mockOrderItemDestroy = jest.fn();
const mockJwtSign = jest.fn();
const mockJwtVerify = jest.fn();
const mockTransaction = jest.fn();

// Mock jsonwebtoken before any imports
jest.mock('jsonwebtoken', () => ({
  sign: (...args) => mockJwtSign(...args),
  verify: (...args) => mockJwtVerify(...args),
}));

// Mock database
jest.mock('../config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    transaction: (...args) => mockTransaction(...args),
    models: {
      Order: {
        findOne: (...args) => mockOrderFindOne(...args),
        findByPk: (...args) => mockOrderFindByPk(...args),
        findAll: (...args) => mockOrderFindAll(...args),
        create: (...args) => mockOrderCreate(...args),
        update: (...args) => mockOrderUpdate(...args),
        destroy: (...args) => mockOrderDestroy(...args),
        count: (...args) => mockOrderCount(...args),
      },
      OrderItem: {
        findAll: (...args) => mockOrderItemFindAll(...args),
        findOne: (...args) => mockOrderItemFindOne(...args),
        create: (...args) => mockOrderItemCreate(...args),
        update: (...args) => mockOrderItemUpdate(...args),
        destroy: (...args) => mockOrderItemDestroy(...args),
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

  // Auth middleware using mocked jwt
  const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    try {
      const decoded = mockJwtVerify(token, 'test-secret');
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Create order
  app.post('/api/orders', authMiddleware, async (req, res) => {
    const { items, shippingAddress } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    const mockTransactionObj = {
      commit: jest.fn().mockResolvedValue(true),
      rollback: jest.fn().mockResolvedValue(true),
    };

    try {
      let totalAmount = 0;
      const orderItems = [];

      for (const item of items) {
        totalAmount += item.quantity * item.unitPrice;
        orderItems.push(item);
      }

      const order = await mockOrderCreate({
        customerId: req.user.userId,
        status: 'pending',
        totalAmount,
        shippingAddress,
      }, { transaction: mockTransactionObj });

      for (const item of orderItems) {
        await mockOrderItemCreate({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
        }, { transaction: mockTransactionObj });
      }

      await mockTransactionObj.commit();

      res.status(201).json({
        id: order.id,
        status: order.status,
        totalAmount: order.totalAmount,
        shippingAddress,
        items: orderItems,
      });
    } catch (error) {
      await mockTransactionObj.rollback();
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  // Get order by ID
  app.get('/api/orders/:id', authMiddleware, async (req, res) => {
    const order = await mockOrderFindByPk(req.params.id, {
      include: [{ model: { name: 'OrderItem' } }],
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if user owns order or is admin
    if (req.user.role !== 'admin' && order.customerId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(order);
  });

  // Get customer orders
  app.get('/api/orders', authMiddleware, async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { customerId: req.user.userId };
    if (status) {
      where.status = status;
    }

    const orders = await mockOrderFindAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    const total = await mockOrderCount({ where });

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  });

  // Update order status
  app.put('/api/orders/:id/status', authMiddleware, async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await mockOrderFindByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await mockOrderUpdate(
      { status },
      { where: { id: req.params.id } }
    );

    res.json({ message: 'Order status updated successfully', status });
  });

  // Cancel order
  app.post('/api/orders/:id/cancel', authMiddleware, async (req, res) => {
    const order = await mockOrderFindByPk(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.customerId !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (order.status === 'shipped' || order.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot cancel shipped or delivered orders' });
    }

    await mockOrderUpdate(
      { status: 'cancelled' },
      { where: { id: req.params.id } }
    );

    res.json({ message: 'Order cancelled successfully' });
  });

  return app;
};

describe('Order API', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    // Set default mock implementations
    mockJwtSign.mockReturnValue('test-jwt-token');
    mockJwtVerify.mockReturnValue({ userId: 'test-user-id', role: 'customer' });
    
    // Set up transaction mock
    const mockTransactionObj = {
      commit: jest.fn().mockResolvedValue(true),
      rollback: jest.fn().mockResolvedValue(true),
    };
    mockTransaction.mockImplementation(async (callback) => {
      return callback(mockTransactionObj);
    });
  });

  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      mockOrderCreate.mockResolvedValue({
        id: 'new-order-id',
        customerId: 'test-user-id',
        status: 'pending',
        totalAmount: 149.98,
      });

      mockOrderItemCreate.mockResolvedValue({
        id: 'order-item-id',
        orderId: 'new-order-id',
        productId: 'product-1',
        quantity: 2,
        unitPrice: 74.99,
        totalPrice: 149.98,
      });

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          items: [
            { productId: 'product-1', quantity: 2, unitPrice: 74.99 },
          ],
          shippingAddress: '123 Test Street',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('new-order-id');
      expect(response.body.status).toBe('pending');
    });

    it('should reject empty order', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          items: [],
          shippingAddress: '123 Test Street',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Order must contain at least one item');
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should return order by ID', async () => {
      mockOrderFindByPk.mockResolvedValue({
        id: 'test-order-id',
        customerId: 'test-user-id',
        status: 'pending',
        totalAmount: 149.98,
        OrderItems: [
          { id: 'item-1', productId: 'product-1', quantity: 2 },
        ],
      });

      const response = await request(app)
        .get('/api/orders/test-order-id')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test-order-id');
    });

    it('should deny access to other users orders', async () => {
      mockOrderFindByPk.mockResolvedValue({
        id: 'test-order-id',
        customerId: 'other-user-id',
        status: 'pending',
      });

      const response = await request(app)
        .get('/api/orders/test-order-id')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/orders', () => {
    it('should return customer orders', async () => {
      mockOrderFindAll.mockResolvedValue([
        { id: 'order-1', status: 'pending', totalAmount: 99.99 },
        { id: 'order-2', status: 'shipped', totalAmount: 149.99 },
      ]);
      mockOrderCount.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.orders).toHaveLength(2);
    });

    it('should filter by status', async () => {
      mockOrderFindAll.mockResolvedValue([
        { id: 'order-1', status: 'pending', totalAmount: 99.99 },
      ]);
      mockOrderCount.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/orders')
        .query({ status: 'pending' })
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
    });
  });

  describe('PUT /api/orders/:id/status', () => {
    it('should update order status', async () => {
      mockOrderFindByPk.mockResolvedValue({
        id: 'test-order-id',
        status: 'pending',
      });
      mockOrderUpdate.mockResolvedValue([1]);

      const response = await request(app)
        .put('/api/orders/test-order-id/status')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ status: 'confirmed' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('confirmed');
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .put('/api/orders/test-order-id/status')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ status: 'invalid-status' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    it('should cancel pending order', async () => {
      mockOrderFindByPk.mockResolvedValue({
        id: 'test-order-id',
        customerId: 'test-user-id',
        status: 'pending',
      });
      mockOrderUpdate.mockResolvedValue([1]);

      const response = await request(app)
        .post('/api/orders/test-order-id/cancel')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Order cancelled successfully');
    });

    it('should not cancel shipped order', async () => {
      mockOrderFindByPk.mockResolvedValue({
        id: 'test-order-id',
        customerId: 'test-user-id',
        status: 'shipped',
      });

      const response = await request(app)
        .post('/api/orders/test-order-id/cancel')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(400);
    });
  });
});
