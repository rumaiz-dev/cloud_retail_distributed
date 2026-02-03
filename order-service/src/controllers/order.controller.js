const Joi = require('joi');
const orderService = require('../services/order.service');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

// Validation schemas
const createOrderSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    productId: Joi.string().required(),
    sku: Joi.string().required(),
    name: Joi.string().required(),
    quantity: Joi.number().min(1).required(),
    price: Joi.number().min(0).required()
  })).min(1).required(),
  shippingAddress: Joi.string().required(),
  paymentMethod: Joi.string().required(),
  notes: Joi.string().allow('')
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'processing', 'shipped', 'delivered', 'cancelled').required()
});

class OrderController {
  /**
   * Get user's orders (paginated)
   */
  async getUserOrders(req, res, next) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      
      const result = await orderService.getUserOrders(req.user.id, {
        status,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        total: result.count,
        page: parseInt(page),
        limit: parseInt(limit),
        orders: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(req, res, next) {
    try {
      const order = await orderService.getOrder(req.params.id, req.user.id);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json(order);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new order
   */
  async createOrder(req, res, next) {
    try {
      const { error } = createOrderSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const order = await orderService.createOrder(
        req.user.id,
        req.body.items,
        {
          shippingAddress: req.body.shippingAddress,
          paymentMethod: req.body.paymentMethod,
          notes: req.body.notes
        }
      );

      res.status(201).json({
        message: 'Order created successfully',
        order
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(req, res, next) {
    try {
      const order = await orderService.cancelOrder(req.params.id, req.user.id);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json({ message: 'Order cancelled successfully', order });
    } catch (error) {
      if (error.message === 'Order not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Unauthorized') {
        return res.status(403).json({ error: error.message });
      }
      if (error.message === 'Order cannot be cancelled in current status') {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Update order status (admin only)
   */
  async updateOrderStatus(req, res, next) {
    try {
      const { error } = updateStatusSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const isAdmin = req.user.role === 'admin';
      const order = await orderService.updateOrderStatus(req.params.id, req.body.status, isAdmin);

      res.json({
        message: 'Order status updated',
        order
      });
    } catch (error) {
      if (error.message === 'Order not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Invalid status') {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get all orders (admin only)
   */
  async getAllOrders(req, res, next) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      
      const result = await orderService.getAllOrders({
        status,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        total: result.count,
        page: parseInt(page),
        limit: parseInt(limit),
        orders: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(req, res, next) {
    try {
      await sequelize.authenticate();
      res.json({
        status: 'healthy',
        service: 'order-service',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'order-service',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }
}

module.exports = new OrderController();
