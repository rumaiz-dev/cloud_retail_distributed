const { OrderItem } = require('../models');

class OrderItemRepository {
  async findByOrderId(orderId) {
    return OrderItem.findAll({ where: { orderId } });
  }

  async createBulk(items) {
    return OrderItem.bulkCreate(items);
  }

  async deleteByOrderId(orderId) {
    return OrderItem.destroy({ where: { orderId } });
  }
}

module.exports = new OrderItemRepository();
