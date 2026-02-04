const Joi = require('joi');
const { sequelize } = require('../config/database');
const inventoryService = require('../services/inventory.service');
const logger = require('../utils/logger');

// Validation schemas
const createInventorySchema = Joi.object({
  sku: Joi.string().required(),
  productId: Joi.string().uuid().required(),
  warehouseId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(0).default(0),
  minimumStock: Joi.number().integer().min(0).default(0),
  location: Joi.string().required(),
  lastRestocked: Joi.date().optional()
});

const reserveStockSchema = Joi.object({
  orderId: Joi.string().required(),
  items: Joi.array().items(Joi.object({
    sku: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required()
  })).required()
});

const releaseReservationSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    sku: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required()
  })).required()
});

// Get all inventory
const getAllInventory = async (req, res, next) => {
  try {
    const inventory = await inventoryService.getAllInventory();
    res.json({
      count: inventory.length,
      items: inventory.map(inv => ({
        id: inv.id,
        sku: inv.sku,
        productId: inv.productId,
        warehouseId: inv.warehouseId,
        quantity: inv.quantity,
        reservedQuantity: inv.reservedQuantity,
        minimumStock: inv.minimumStock,
        location: inv.location,
        lastRestocked: inv.lastRestocked
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

// Get stock by SKU
const getStock = async (req, res, next) => {
  try {
    const inventory = await inventoryService.getStock(req.params.sku);
    res.json({
      sku: inventory.sku,
      productId: inventory.productId,
      warehouseId: inventory.warehouseId,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      minimumStock: inventory.minimumStock,
      location: inventory.location,
      lastRestocked: inventory.lastRestocked,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.message === 'Product not found in inventory') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};

// Create inventory record
const createInventory = async (req, res, next) => {
  try {
    const { error } = createInventorySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const inventory = await inventoryService.createInventory(req.body);
    res.status(201).json({
      message: 'Inventory record created successfully',
      inventory: {
        id: inventory.id,
        sku: inventory.sku,
        productId: inventory.productId,
        warehouseId: inventory.warehouseId,
        quantity: inventory.quantity,
        minimumStock: inventory.minimumStock,
        location: inventory.location,
        lastRestocked: inventory.lastRestocked
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update inventory
const updateInventory = async (req, res, next) => {
  try {
    const inventory = await inventoryService.updateStock(req.params.id, req.body);
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }
    res.json({
      message: 'Inventory updated successfully',
      inventory
    });
  } catch (error) {
    next(error);
  }
};

// Adjust stock quantity
const adjustStock = async (req, res, next) => {
  try {
    const { adjustment } = req.body;
    if (typeof adjustment !== 'number') {
      return res.status(400).json({ error: 'Adjustment must be a number' });
    }

    const inventory = await inventoryService.adjustStock(req.params.id, adjustment);
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }
    res.json({
      sku: inventory.sku,
      quantity: inventory.quantity,
      message: 'Stock adjusted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Reserve stock for order
const reserveStock = async (req, res, next) => {
  try {
    const { error } = reserveStockSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { orderId, items } = req.body;
    
    const result = await sequelize.transaction(async (t) => {
      const reservations = [];
      for (const item of items) {
        const inventory = await inventoryService.reserveStock(item.sku, orderId, item.quantity);
        reservations.push({
          sku: item.sku,
          quantity: item.quantity
        });
      }
      return reservations;
    });

    res.json({
      message: 'Stock reserved successfully',
      orderId,
      reservations: result,
      expiresIn: '30 minutes'
    });
  } catch (error) {
    logger.error('Reserve stock error:', error);
    if (error.message.startsWith('Insufficient stock')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};

// Release reservation
const releaseReservation = async (req, res, next) => {
  try {
    const { error } = releaseReservationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await inventoryService.releaseReservation(req.params.orderId, req.body.items);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// Confirm reservation
const confirmReservation = async (req, res, next) => {
  try {
    const result = await inventoryService.confirmReservation(req.params.orderId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// Get low stock items
const getLowStockItems = async (req, res, next) => {
  try {
    const items = await inventoryService.getLowStockItems();
    res.json({
      count: items.length,
      items: items.map(item => ({
        id: item.id,
        sku: item.sku,
        quantity: item.quantity,
        minimumStock: item.minimumStock
      }))
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllInventory,
  getStock,
  createInventory,
  updateInventory,
  adjustStock,
  reserveStock,
  releaseReservation,
  confirmReservation,
  getLowStockItems
};
