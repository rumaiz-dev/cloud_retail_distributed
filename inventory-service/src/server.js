const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const amqplib = require('amqplib');
const winston = require('winston');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const consul = require('consul');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3004;

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/inventory-service.log' })
  ]
});

// Sequelize connection
const sequelize = new Sequelize(
  process.env.DB_NAME || 'cloudretail',
  process.env.DB_USER || 'cloudretail',
  process.env.DB_PASSWORD || 'cloudretail123',
  {
    host: process.env.DB_HOST || 'postgres',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
  }
);

// Inventory model
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

// RabbitMQ
let channel = null;
let inventoryQueue = null;

// Initialize connections
const initConnections = async () => {
  try {
    // Connect to PostgreSQL
    await sequelize.authenticate();
    logger.info('Inventory Service: PostgreSQL connected');

    // Sync database
    await sequelize.sync();

    // Connect to RabbitMQ
    const connection = await amqplib.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq');
    channel = await connection.createChannel();
    
    // Declare exchanges and queues
    await channel.assertExchange('inventory-events', 'topic', { durable: true });
    await channel.assertExchange('order-events', 'topic', { durable: true });
    
    // Queue for order events
    inventoryQueue = await channel.assertQueue('inventory-order-events', { durable: true });
    await channel.bindQueue('inventory-order-events', 'order-events', 'order.created');
    await channel.bindQueue('inventory-order-events', 'order-events', 'order.cancelled');
    
    logger.info('Connected to RabbitMQ');
  } catch (error) {
    logger.error('Connection error:', error);
    setTimeout(initConnections, 5000);
  }
};

// Validation schemas
const updateStockSchema = Joi.object({
  sku: Joi.string().required(),
  quantity: Joi.number().integer().required(),
  operation: Joi.string().valid('increment', 'decrement', 'set').required()
});

// Middleware
app.use(helmet());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  const dbStatus = sequelize ? 'connected' : 'disconnected';
  const rabbitmqStatus = channel ? 'connected' : 'disconnected';
  
  res.json({
    status: 'healthy',
    service: 'inventory-service',
    timestamp: new Date().toISOString(),
    connections: {
      postgres: dbStatus,
      rabbitmq: rabbitmqStatus
    }
  });
});

// Get stock for product
app.get('/:sku', async (req, res) => {
  try {
    const inventory = await Inventory.findOne({ where: { sku: req.params.sku } });
    if (!inventory) {
      return res.status(404).json({ error: 'Product not found in inventory' });
    }
    
    res.json({
      sku: req.params.sku,
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
    logger.error('Get stock error:', error);
    res.status(500).json({ error: 'Failed to get stock' });
  }
});

// Get all inventory
app.get('/', async (req, res) => {
  try {
    const inventory = await Inventory.findAll();
    res.json({
      count: inventory.length,
      items: inventory.map(inv => ({
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
    logger.error('Get all inventory error:', error);
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

// Update stock
app.post('/update', async (req, res) => {
  try {
    const { error } = updateStockSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { sku, quantity, operation } = req.body;
    let newStock;

    // Use transaction for data integrity
    const result = await sequelize.transaction(async (t) => {
      let inventory = await Inventory.findOne({ where: { sku }, transaction: t });

      if (!inventory) {
        // Create new inventory record if it doesn't exist
        inventory = await Inventory.create({
          sku,
          quantity: operation === 'set' ? quantity : 0
        }, { transaction: t });
      }

      switch (operation) {
        case 'increment':
          inventory.quantity += quantity;
          break;
        case 'decrement':
          inventory.quantity -= quantity;
          if (inventory.quantity < 0) {
            throw new Error('Insufficient stock');
          }
          break;
        case 'set':
          inventory.quantity = quantity;
          break;
      }

      await inventory.save({ transaction: t });
      return inventory.quantity;
    });

    newStock = result;

    // Publish stock update event
    if (channel) {
      channel.publish('inventory-events', 'stock.updated', Buffer.from(JSON.stringify({
        event: 'STOCK_UPDATED',
        sku,
        quantity: newStock,
        operation,
        timestamp: new Date().toISOString()
      })));
    }

    logger.info(`Stock updated: ${sku} = ${newStock}`);

    res.json({
      sku,
      stock: newStock,
      message: 'Stock updated successfully'
    });
  } catch (error) {
    logger.error('Update stock error:', error);
    if (error.message === 'Insufficient stock') {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// Create inventory record
app.post('/', async (req, res) => {
  try {
    const { sku, productId, warehouseId, quantity, minimumStock, location } = req.body;
    
    const inventory = await Inventory.create({
      sku,
      productId: productId || null,
      warehouseId: warehouseId || null,
      quantity: quantity || 0,
      minimumStock: minimumStock || 0,
      location: location || null
    });

    res.json({
      message: 'Inventory record created successfully',
      inventory: {
        id: inventory.id,
        sku: inventory.sku,
        productId: inventory.productId,
        warehouseId: inventory.warehouseId,
        quantity: inventory.quantity,
        minimumStock: inventory.minimumStock,
        location: inventory.location
      }
    });
  } catch (error) {
    logger.error('Create inventory error:', error);
    res.status(500).json({ error: 'Failed to create inventory record' });
  }
});

// Adjust stock quantity
app.put('/:sku/adjust', async (req, res) => {
  try {
    const { adjustment } = req.body;
    const { sku } = req.params;

    const inventory = await Inventory.findOne({ where: { sku } });
    if (!inventory) {
      return res.status(404).json({ error: 'Product not found in inventory' });
    }

    inventory.quantity += adjustment;
    await inventory.save();

    res.json({
      sku,
      quantity: inventory.quantity,
      message: 'Stock adjusted successfully'
    });
  } catch (error) {
    logger.error('Adjust stock error:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

// Reserve stock for order
app.post('/reserve', async (req, res) => {
  try {
    const { orderId, items } = req.body;

    // Use transaction for data integrity
    const result = await sequelize.transaction(async (t) => {
      const reservations = [];

      for (const item of items) {
        const inventory = await Inventory.findOne({ 
          where: { sku: item.sku },
          transaction: t 
        });

        const availableStock = inventory ? inventory.quantity : 0;

        if (availableStock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.sku}`);
        }

        // Reserve stock
        inventory.quantity -= item.quantity;
        inventory.reservedQuantity += item.quantity;
        await inventory.save({ transaction: t });

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
      return res.status(400).json({ 
        error: error.message,
        available: 0,
        required: 0
      });
    }
    res.status(500).json({ error: 'Failed to reserve stock' });
  }
});

// Confirm reservation
app.post('/confirm-reservation/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // In PostgreSQL, reservations are already permanent
    // Just log the confirmation
    logger.info(`Reservation confirmed for order ${orderId}`);

    res.json({ message: 'Reservation confirmed' });
  } catch (error) {
    logger.error('Confirm reservation error:', error);
    res.status(500).json({ error: 'Failed to confirm reservation' });
  }
});

// Release reservation
app.post('/release-reservation/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items list is required' });
    }

    // Use transaction for data integrity
    await sequelize.transaction(async (t) => {
      for (const item of items) {
        const inventory = await Inventory.findOne({ 
          where: { sku: item.sku },
          transaction: t 
        });

        if (inventory) {
          inventory.quantity += item.quantity;
          inventory.reservedQuantity -= item.quantity;
          await inventory.save({ transaction: t });
        }
      }
    });

    logger.info(`Released reservation for order ${orderId}`);
    res.json({ message: 'Reservation released' });
  } catch (error) {
    logger.error('Release reservation error:', error);
    res.status(500).json({ error: 'Failed to release reservation' });
  }
});

// Process order events from RabbitMQ
const processOrderEvents = async (msg) => {
  try {
    const event = JSON.parse(msg.content.toString());
    
    switch (event.event) {
      case 'ORDER_CREATED':
        // Check and reserve stock
        const result = await checkAndReserveStock(event.orderId, event.items);
        
        if (result.success) {
          // Publish success event
          channel.publish('inventory-events', 'stock.reserved', Buffer.from(JSON.stringify({
            event: 'STOCK_RESERVED',
            orderId: event.orderId,
            timestamp: new Date().toISOString()
          })));
        } else {
          // Publish failure event
          channel.publish('inventory-events', 'stock.reservation.failed', Buffer.from(JSON.stringify({
            event: 'STOCK_RESERVATION_FAILED',
            orderId: event.orderId,
            reason: result.reason,
            timestamp: new Date().toISOString()
          })));
        }
        break;
        
      case 'ORDER_CANCELLED':
        // Release reserved stock
        await releaseReservedStock(event.orderId, event.items);
        break;
    }
    
    channel.ack(msg);
  } catch (error) {
    logger.error('Process order event error:', error);
  }
};

// Helper function to check and reserve stock
const checkAndReserveStock = async (orderId, items) => {
  try {
    // Use transaction for data integrity
    const result = await sequelize.transaction(async (t) => {
      // Check stock for all items
      for (const item of items) {
        const inventory = await Inventory.findOne({ 
          where: { sku: item.sku },
          transaction: t 
        });
        
        const stock = inventory ? inventory.quantity : 0;
        
        if (stock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.sku}`);
        }
      }
      
      // Reserve stock for all items
      for (const item of items) {
        const inventory = await Inventory.findOne({ 
          where: { sku: item.sku },
          transaction: t 
        });
        
        inventory.quantity -= item.quantity;
        inventory.reservedQuantity += item.quantity;
        await inventory.save({ transaction: t });
      }
      
      return { success: true };
    });
    
    return result;
  } catch (error) {
    logger.error('Check and reserve stock error:', error);
    return { success: false, reason: error.message };
  }
};

// Helper function to release reserved stock
const releaseReservedStock = async (orderId, items) => {
  try {
    if (!items || !Array.isArray(items)) {
      logger.warn(`No items provided for order ${orderId}`);
      return;
    }

    await sequelize.transaction(async (t) => {
      for (const item of items) {
        const inventory = await Inventory.findOne({ 
          where: { sku: item.sku },
          transaction: t 
        });
        
        if (inventory) {
          inventory.quantity += item.quantity;
          inventory.reservedQuantity -= item.quantity;
          await inventory.save({ transaction: t });
        }
      }
    });
    
    logger.info(`Released stock for order ${orderId}`);
  } catch (error) {
    logger.error('Release reserved stock error:', error);
  }
};

// Consul registration
const registerWithConsul = async () => {
  const consulClient = new consul({ host: 'consul', port: 8500 });
  
  await consulClient.agent.service.register({
    name: 'inventory-service',
    address: 'inventory-service',
    port: parseInt(PORT),
    check: {
      http: `http://inventory-service:${PORT}/health`,
      interval: '10s',
      timeout: '5s'
    }
  });
  
  logger.info('Registered inventory-service with Consul');
};

// Initialize
const init = async () => {
  try {
    await initConnections();
    
    // Start consuming order events
    if (channel && inventoryQueue) {
      channel.consume('inventory-order-events', processOrderEvents);
    }
    
    app.listen(PORT, async () => {
      logger.info(`Inventory service running on port ${PORT}`);
      await registerWithConsul();
    });
  } catch (error) {
    logger.error('Initialization failed:', error);
    process.exit(1);
  }
};

init();

process.on('SIGTERM', async () => {
  logger.info('Shutting down inventory service...');
  if (sequelize) {
    await sequelize.close();
  }
  if (channel) {
    await channel.close();
  }
  process.exit(0);
});

module.exports = app;
