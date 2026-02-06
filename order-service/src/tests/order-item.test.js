/**
 * Order Service - Order Item Tests
 * Tests for order item management
 */

const request = require('supertest');
const express = require('express');

// Create mock implementations at module level
const mockOrderFindOne = jest.fn();
const mockOrderFindByPk = jest.fn();
const mockOrderFindAll = jest.fn();
const mockOrderUpdate = jest.fn();
const mockOrderItemFindOne = jest.fn();
const mockOrderItemFindAll = jest.fn();
const mockOrderItemCreate = jest.fn();
const mockOrderItemUpdate = jest.fn();
const mockOrderItemDestroy = jest.fn();
const mockJwtSign = jest.fn();
const mockJwtVerify = jest.fn();

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
    models: {
      Order: {
        findOne: (...args) => mockOrderFindOne(...args),
        findByPk: (...args) => mockOrderFindByPk(...args),
        findAll: (...args) => mockOrderFindAll(...args),
        update: (...args) => mockOrderUpdate(...args),
      },
      OrderItem: {
        findOne: (...args) => mockOrderItemFindOne(...args),
        findAll: (...args) => mockOrderItemFindAll(...args),
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

  // Get order items
  app.get('/api/orders/:orderId/items', authMiddleware, async (req, res) => {
    const order = await mockOrderFindByPk(req.params.orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (req.user.role !== 'admin' && order.customerId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const items = await mockOrderItemFindAll({
      where: { orderId: req.params.orderId },
    });

    res.json({ items });
  });

  // Add item to order (only if order is pending)
  app.post('/api/orders/:orderId/items', authMiddleware, async (req, res) => {
    const { productId, quantity, unitPrice } = req.body;

    const order = await mockOrderFindByPk(req.params.orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (req.user.role !== 'admin' && order.customerId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot add items to non-pending orders' });
    }

    const orderItem = await mockOrderItemCreate({
      orderId: req.params.orderId,
      productId,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
    });

    // Update order total
    const items = await mockOrderItemFindAll({
      where: { orderId: req.params.orderId },
    });

    const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

    await mockOrderUpdate(
      { totalAmount },
      { where: { id: req.params.orderId } }
    );

    res.status(201).json(orderItem);
  });

  // Update order item
  app.put('/api/orders/:orderId/items/:itemId', authMiddleware, async (req, res) => {
    const { quantity } = req.body;

    const order = await mockOrderFindByPk(req.params.orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (req.user.role !== 'admin' && order.customerId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot update items in non-pending orders' });
    }

    const orderItem = await mockOrderItemFindOne({
      where: { id: req.params.itemId, orderId: req.params.orderId },
    });

    if (!orderItem) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    const unitPrice = orderItem.unitPrice;
    await mockOrderItemUpdate(
      { quantity, totalPrice: quantity * unitPrice },
      { where: { id: req.params.itemId } }
    );

    res.json({ message: 'Order item updated successfully' });
  });

  // Remove order item
  app.delete('/api/orders/:orderId/items/:itemId', authMiddleware, async (req, res) => {
    const order = await mockOrderFindByPk(req.params.orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (req.user.role !== 'admin' && order.customerId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot remove items from non-pending orders' });
    }

    await mockOrderItemDestroy({
      where: { id: req.params.itemId, orderId: req.params.orderId },
    });

    // Recalculate order total
    const items = await mockOrderItemFindAll({
      where: { orderId: req.params.orderId },
    });

    const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

    await mockOrderUpdate(
      { totalAmount },
      { where: { id: req.params.orderId } }
    );

    res.json({ message: 'Order item removed successfully' });
  });

  return app;
};

describe('Order Item API', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    // Set default mock implementations
    mockJwtSign.mockReturnValue('test-jwt-token');
    mockJwtVerify.mockReturnValue({ userId: 'test-user-id', role: 'customer' });
  });

  describe('GET /api/orders/:orderId/items', () => {
    it('should return order items', async () => {
      mockOrderFindByPk.mockResolvedValue({
        id: 'test-order-id',
        customerId: 'test-user-id',
        status: 'pending',
      });
      mockOrderItemFindAll.mockResolvedValue([
        { id: 'item-1', productId: 'product-1', quantity: 2, unitPrice: 49.99 },
        { id: 'item-2', productId: 'product-2', quantity: 1, unitPrice: 99.99 },
      ]);

      const response = await request(app)
        .get('/api/orders/test-order-id/items')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(2);
    });
  });

  describe('POST /api/orders/:orderId/items', () => {
    it('should add item to pending order', async () => {
      mockOrderFindByPk.mockResolvedValue({
        id: 'test-order-id',
        customerId: 'test-user-id',
        status: 'pending',
      });
      mockOrderItemCreate.mockResolvedValue({
        id: 'new-item-id',
        orderId: 'test-order-id',
        productId: 'product-1',
        quantity: 2,
        unitPrice: 49.99,
        totalPrice: 99.98,
      });
      mockOrderItemFindAll.mockResolvedValue([
        { id: 'new-item-id', totalPrice: 99.98 },
      ]);
      mockOrderUpdate.mockResolvedValue([1]);

      const response = await request(app)
        .post('/api/orders/test-order-id/items')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          productId: 'product-1',
          quantity: 2,
          unitPrice: 49.99,
        });

      expect(response.status).toBe(201);
      expect(response.body.productId).toBe('product-1');
    });

    it('should reject adding items to shipped order', async () => {
      mockOrderFindByPk.mockResolvedValue({
        id: 'test-order-id',
        customerId: 'test-user-id',
        status: 'shipped',
      });

      const response = await request(app)
        .post('/api/orders/test-order-id/items')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          productId: 'product-1',
          quantity: 2,
          unitPrice: 49.99,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot add items to non-pending orders');
    });
  });

  describe('PUT /api/orders/:orderId/items/:itemId', () => {
    it('should update order item quantity', async () => {
      mockOrderFindByPk.mockResolvedValue({
        id: 'test-order-id',
        customerId: 'test-user-id',
        status: 'pending',
      });
      mockOrderItemFindOne.mockResolvedValue({
        id: 'item-1',
        orderId: 'test-order-id',
        unitPrice: 49.99,
      });
      mockOrderItemUpdate.mockResolvedValue([1]);

      const response = await request(app)
        .put('/api/orders/test-order-id/items/item-1')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ quantity: 5 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Order item updated successfully');
    });
  });

  describe('DELETE /api/orders/:orderId/items/:itemId', () => {
    it('should remove order item', async () => {
      mockOrderFindByPk.mockResolvedValue({
        id: 'test-order-id',
        customerId: 'test-user-id',
        status: 'pending',
      });
      mockOrderItemDestroy.mockResolvedValue(1);
      mockOrderItemFindAll.mockResolvedValue([]);
      mockOrderUpdate.mockResolvedValue([1]);

      const response = await request(app)
        .delete('/api/orders/test-order-id/items/item-1')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Order item removed successfully');
    });
  });
});
