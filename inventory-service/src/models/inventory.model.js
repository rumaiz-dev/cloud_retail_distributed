const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: false
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'product_id'
  },
  warehouseId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'warehouse_id'
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  reservedQuantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'reserved_quantity'
  },
  minimumStock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'minimum_stock'
  },
  location: {
    type: DataTypes.STRING
  },
  lastRestocked: {
    type: DataTypes.DATE,
    field: 'last_restocked'
  }
}, {
  tableName: 'inventory',
  timestamps: true
});

module.exports = Inventory;
