const { Op } = require('sequelize');
const { Order, OrderItem } = require('../models');

class OrderRepository {
  async findById(id) {
    return Order.findByPk(id, {
      include: [{ model: OrderItem, as: 'items' }]
    });
  }

  async findByOrderNumber(orderNumber) {
    return Order.findOne({
      where: { orderNumber },
      include: [{ model: OrderItem, as: 'items' }]
    });
  }

  async findByUserId(userId, options = {}) {
    const { page = 1, limit = 10, status } = options;
    const where = { userId };
    
    if (status) {
      where.status = status;
    }

    return Order.findAndCountAll({
      where,
      include: [{ model: OrderItem, as: 'items' }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (page - 1) * limit
    });
  }

  async findAll(options = {}) {
    const { page = 1, limit = 10, status } = options;
    const where = {};
    
    if (status) {
      where.status = status;
    }

    return Order.findAndCountAll({
      where,
      include: [{ model: OrderItem, as: 'items' }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (page - 1) * limit
    });
  }

  async create(data) {
    return Order.create(data);
  }

  async update(id, data) {
    const order = await this.findById(id);
    if (!order) return null;
    
    await order.update(data);
    return this.findById(id);
  }

  async updateStatus(id, status) {
    const order = await this.findById(id);
    if (!order) return null;
    
    const oldStatus = order.status;
    await order.update({ status });
    
    return { order, oldStatus };
  }

  async delete(id) {
    const order = await this.findById(id);
    if (!order) return false;
    
    await OrderItem.destroy({ where: { orderId: id } });
    await order.destroy();
    return true;
  }
}

module.exports = new OrderRepository();
