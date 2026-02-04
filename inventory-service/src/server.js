const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const consul = require('consul');
const { initDatabase, connectRabbitMQ, getChannel, QUEUE_NAME } = require('./config/database');
const inventoryRoutes = require('./routes/inventory.routes');
const errorHandler = require('./middlewares/error.middleware');
const logger = require('./utils/logger');
const inventoryService = require('./services/inventory.service');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:8080',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/api/v1/inventory', inventoryRoutes);

// Health check
app.get('/health', async (req, res) => {
  const channel = getChannel();
  const dbStatus = 'connected'; // Simplified for health check
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

// Error handler
app.use(errorHandler);

// Process order events from RabbitMQ
const processOrderEvents = async (msg) => {
  try {
    const event = JSON.parse(msg.content.toString());
    
    switch (event.event) {
      case 'ORDER_CREATED':
        const result = await inventoryService.checkAndReserveStock(event.orderId, event.items);
        
        if (result.success) {
          // Publish success event
          const { publishEvent } = require('./config/database');
          await publishEvent('inventory-events', 'stock.reserved', {
            event: 'STOCK_RESERVED',
            orderId: event.orderId
          });
        } else {
          // Publish failure event
          const { publishEvent } = require('./config/database');
          await publishEvent('inventory-events', 'stock.reservation.failed', {
            event: 'STOCK_RESERVATION_FAILED',
            orderId: event.orderId,
            reason: result.reason
          });
        }
        break;
        
      case 'ORDER_CANCELLED':
        await inventoryService.releaseReservedStock(event.orderId, event.items);
        break;
    }
    
    const channel = getChannel();
    if (channel) channel.ack(msg);
  } catch (error) {
    logger.error('Process order event error:', error);
  }
};

// Register with Consul
const registerWithConsul = () => {
  if (process.env.CONSUL_HOST) {
    const client = new consul({
      host: process.env.CONSUL_HOST || 'consul',
      port: process.env.CONSUL_PORT || 8500
    });

    const serviceId = `inventory-service-${process.env.HOSTNAME || Date.now()}`;
    
    client.agent.service.register({
      id: serviceId,
      name: 'inventory-service',
      address: process.env.HOSTNAME || 'localhost',
      port: parseInt(PORT),
      check: {
        http: `http://${process.env.HOSTNAME || 'localhost'}:${PORT}/health`,
        interval: '10s',
        timeout: '5s'
      }
    }, (err) => {
      if (err) {
        logger.error('Consul registration failed:', err);
      } else {
        logger.info('Registered with Consul');
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      client.agent.service.deregister(serviceId, () => {
        logger.info('Deregistered from Consul');
        process.exit(0);
      });
    });
  }
};

// Initialize and start server
const startServer = async () => {
  try {
    // Initialize database
    await initDatabase();
    
    // Try to connect to RabbitMQ (optional)
    try {
      await connectRabbitMQ();
      logger.info('RabbitMQ connected');
      
      // Start consuming order events
      const channel = getChannel();
      if (channel) {
        await channel.consume(QUEUE_NAME, processOrderEvents);
        logger.info('Started consuming order events');
      }
    } catch (rabbitError) {
      logger.warn('RabbitMQ connection failed, continuing without RabbitMQ:', rabbitError.message);
    }
    
    // Register with Consul
    registerWithConsul();
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Inventory service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
