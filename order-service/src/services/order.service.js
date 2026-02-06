const { sequelize } = require('../config/database');
const orderRepository = require('../repositories/order.repository');
const orderItemRepository = require('../repositories/order-item.repository');
const { publishEvent } = require('../config/database');
const logger = require('../utils/logger');

class OrderService {
  /**
   * Create a new order with transaction
   */
  async createOrder(userId, items, orderData) {
    const transaction = await sequelize.transaction();

    try {
      
      const totalAmount = this.calculateTotal(items);

      // Create order
      const order = await orderRepository.create({
        userId,
        totalAmount,
        shippingAddress: orderData.shippingAddress,
        paymentMethod: orderData.paymentMethod,
        notes: orderData.notes
      }, { transaction });

      
      const orderItems = items.map(item => ({
        orderId: order.id,
        productId: item.productId,
        productName: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.price,
        subtotal: item.price * item.quantity
      }));

      await orderItemRepository.createBulk(orderItems);

      await transaction.commit();

      
      this.publishOrderEvent('order.created', {
        event: 'ORDER_CREATED',
        orderId: order.id,
        userId: order.userId,
        orderNumber: order.orderNumber,
        items,
        totalAmount: order.totalAmount
      });

      logger.info(`Order created: ${order.orderNumber}`);

      return this.getOrder(order.id, userId);
    } catch (error) {
      await transaction.rollback();
      logger.error('Create order error:', error);
      throw error;
    }
  }

  /**
   * Get order by ID with ownership check
   */
  async getOrder(id, userId) {
    const order = await orderRepository.findById(id);
    
    if (!order) {
      return null;
    }

    
    if (userId && order.userId !== userId) {
      return null;
    }

    return order;
  }

  /**
   * Get orders by user ID
   */
  async getUserOrders(userId, options = {}) {
    return orderRepository.findByUserId(userId, options);
  }

  /**
   * Get all orders (admin)
   */
  async getAllOrders(options = {}) {
    return orderRepository.findAll(options);
  }

  /**
   * Cancel order
   */
  async cancelOrder(id, userId) {
    const order = await orderRepository.findById(id);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.userId !== userId) {
      throw new Error('Unauthorized');
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      throw new Error('Order cannot be cancelled in current status');
    }

    await orderRepository.updateStatus(id, 'cancelled');

    
    this.publishOrderEvent('order.cancelled', {
      event: 'ORDER_CANCELLED',
      orderId: order.id,
      userId: order.userId,
      orderNumber: order.orderNumber
    });

    logger.info(`Order cancelled: ${order.orderNumber}`);

    return this.getOrder(id, userId);
  }

  /**
   * Update order status
   */
  async updateOrderStatus(id, status, isAdmin = false) {
    const order = await orderRepository.findById(id);

    if (!order) {
      throw new Error('Order not found');
    }

    const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const { oldStatus } = await orderRepository.updateStatus(id, status);

    
    this.publishOrderEvent('order.status_updated', {
      event: 'ORDER_STATUS_UPDATED',
      orderId: order.id,
      userId: order.userId,
      orderNumber: order.orderNumber,
      oldStatus,
      newStatus: status
    });

    logger.info(`Order status updated: ${order.orderNumber} from ${oldStatus} to ${status}`);

    return this.getOrder(id);
  }

  /**
   * Calculate order total
   */
  calculateTotal(items) {
    return items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
  }

  /**
   * Publish order event
   */
  publishOrderEvent(eventType, data) {
    publishEvent(eventType, data);
  }
}

module.exports = new OrderService();
