const express = require('express');
const redis = require('redis');
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

// Redis client
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:6379`
});

// RabbitMQ
let channel = null;
let inventoryQueue = null;

// Initialize connections
const initConnections = async () => {
  try {
    // Connect to Redis
    await redisClient.connect();
    logger.info('Connected to Redis');

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
  const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
  const rabbitmqStatus = channel ? 'connected' : 'disconnected';
  
  res.json({
    status: 'healthy',
    service: 'inventory-service',
    timestamp: new Date().toISOString(),
    connections: {
      redis: redisStatus,
      rabbitmq: rabbitmqStatus
    }
  });
});

// Get stock for product
app.get('/:sku', async (req, res) => {
  try {
    const stock = await redisClient.hGet('inventory', req.params.sku);
    if (!stock) {
      return res.status(404).json({ error: 'Product not found in inventory' });
    }
    
    res.json({
      sku: req.params.sku,
      stock: parseInt(stock),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get stock error:', error);
    res.status(500).json({ error: 'Failed to get stock' });
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

    switch (operation) {
      case 'increment':
        newStock = await redisClient.hIncrBy('inventory', sku, quantity);
        break;
      case 'decrement':
        newStock = await redisClient.hIncrBy('inventory', sku, -quantity);
        if (newStock < 0) {
          // Rollback
          await redisClient.hIncrBy('inventory', sku, quantity);
          return res.status(400).json({ error: 'Insufficient stock' });
        }
        break;
      case 'set':
        await redisClient.hSet('inventory', sku, quantity);
        newStock = quantity;
        break;
    }

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
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// Reserve stock for order
app.post('/reserve', async (req, res) => {
  try {
    const { orderId, items } = req.body;

    // Check and reserve stock for all items
    const reservations = [];
    const tempReservationKey = `temp_reservation:${orderId}`;

    for (const item of items) {
      const currentStock = await redisClient.hGet('inventory', item.sku);
      const stock = parseInt(currentStock || 0);

      if (stock < item.quantity) {
        // Insufficient stock - release any already reserved items
        await redisClient.del(tempReservationKey);
        return res.status(400).json({ 
          error: `Insufficient stock for ${item.sku}`,
          available: stock,
          required: item.quantity
        });
      }

      // Reserve stock
      await redisClient.hIncrBy('inventory', item.sku, -item.quantity);
      
      // Store reservation
      reservations.push({
        sku: item.sku,
        quantity: item.quantity
      });
    }

    // Store reservation temporarily (expires in 30 minutes)
    await redisClient.setEx(
      tempReservationKey,
      1800,
      JSON.stringify({ orderId, items: reservations })
    );

    res.json({
      message: 'Stock reserved successfully',
      orderId,
      reservations,
      expiresIn: '30 minutes'
    });
  } catch (error) {
    logger.error('Reserve stock error:', error);
    res.status(500).json({ error: 'Failed to reserve stock' });
  }
});

// Confirm reservation
app.post('/confirm-reservation/:orderId', async (req, res) => {
  try {
    const reservationKey = `temp_reservation:${req.params.orderId}`;
    const reservation = await redisClient.get(reservationKey);

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found or expired' });
    }

    // Convert to permanent reservation
    await redisClient.setEx(
      `reservation:${req.params.orderId}`,
      86400, // 24 hours
      reservation
    );

    // Delete temp reservation
    await redisClient.del(reservationKey);

    res.json({ message: 'Reservation confirmed' });
  } catch (error) {
    logger.error('Confirm reservation error:', error);
    res.status(500).json({ error: 'Failed to confirm reservation' });
  }
});

// Release reservation
app.post('/release-reservation/:orderId', async (req, res) => {
  try {
    const reservationKey = `reservation:${req.params.orderId}`;
    const reservation = await redisClient.get(reservationKey);

    if (reservation) {
      const { items } = JSON.parse(reservation);
      
      // Return stock to inventory
      for (const item of items) {
        await redisClient.hIncrBy('inventory', item.sku, item.quantity);
      }

      // Delete reservation
      await redisClient.del(reservationKey);

      logger.info(`Released reservation for order ${req.params.orderId}`);
    }

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
        await releaseReservedStock(event.orderId);
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
    // Check stock for all items
    for (const item of items) {
      const stock = await redisClient.hGet('inventory', item.sku);
      if (!stock || parseInt(stock) < item.quantity) {
        return {
          success: false,
          reason: `Insufficient stock for ${item.sku}`
        };
      }
    }
    
    // Reserve stock
    for (const item of items) {
      await redisClient.hIncrBy('inventory', item.sku, -item.quantity);
    }
    
    // Store reservation
    await redisClient.setEx(
      `reservation:${orderId}`,
      3600, // 1 hour
      JSON.stringify({ items })
    );
    
    return { success: true };
  } catch (error) {
    logger.error('Check and reserve stock error:', error);
    return { success: false, reason: error.message };
  }
};

// Helper function to release reserved stock
const releaseReservedStock = async (orderId) => {
  try {
    const reservationKey = `reservation:${orderId}`;
    const reservation = await redisClient.get(reservationKey);
    
    if (reservation) {
      const { items } = JSON.parse(reservation);
      
      for (const item of items) {
        await redisClient.hIncrBy('inventory', item.sku, item.quantity);
      }
      
      await redisClient.del(reservationKey);
      logger.info(`Released stock for order ${orderId}`);
    }
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
  await redisClient.quit();
  if (channel) {
    await channel.close();
  }
  process.exit(0);
});

module.exports = app;