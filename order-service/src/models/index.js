const Order = require('./order.model');
const OrderItem = require('./order-item.model');

// Set up associations
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

module.exports = {
  Order,
  OrderItem
};
