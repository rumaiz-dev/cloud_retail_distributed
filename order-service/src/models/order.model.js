const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  orderNumber: {
    type: DataTypes.STRING,
    unique: true
  },
  status: {
    type: DataTypes.ENUM(
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled'
    ),
    defaultValue: 'pending'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  shippingAddress: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT
  }
}, {
  timestamps: true,
  tableName: 'orders',
  hooks: {
    beforeCreate: async (order) => {
      if (!order.orderNumber) {
        const date = new Date();
        const timestamp = date.getTime();
        const random = Math.floor(Math.random() * 1000);
        order.orderNumber = `ORD-${timestamp}-${random}`;
      }
    }
  }
});

module.exports = Order;
