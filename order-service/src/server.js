require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const consul = require('consul');

const { sequelize, connectRabbitMQ, getChannel, SAGA_QUEUE } = require('./config/database');
const orderRoutes = require('./routes/order.routes');
const { errorMiddleware, notFoundHandler } = require('./middlewares/error.middleware');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(express.json());

// Routes
app.use('/api/v1/orders', orderRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorMiddleware);

// Consul registration
const registerWithConsul = async () => {
  const consulClient = new consul({ host: 'consul', port: 8500 });
  
  await consulClient.agent.service.register({
    name: 'order-service',
    address: 'order-service',
    port: parseInt(PORT),
    check: {
      http: `http://order-service:${PORT}/api/v1/orders/health`,
      interval: '10s',
      timeout: '5s'
    }
  });
  
  logger.info('Registered order-service with Consul');
};

// Saga compensation handler
const handleSagaCompensation = async (msg) => {
  try {
    const event = JSON.parse(msg.content.toString());
    
    if (event.event === 'INVENTORY_CHECK_FAILED') {
      // Compensate by cancelling the order
      const { Order } = require('./models');
      await Order.update(
        { status: 'cancelled' },
        { where: { id: event.orderId } }
      );
      logger.info(`Compensated order ${event.orderId} due to inventory failure`);
    }
    
    const channel = getChannel();
    if (channel) {
      channel.ack(msg);
    }
  } catch (error) {
    logger.error('Saga compensation error:', error);
  }
};

// Handle inventory.reservation_confirmed event
const handleInventoryReservationConfirmed = async (msg) => {
  try {
    const event = JSON.parse(msg.content.toString());
    
    logger.info(`Inventory reservation confirmed for order: ${event.orderId}`);
    
    const channel = getChannel();
    if (channel) {
      channel.ack(msg);
    }
  } catch (error) {
    logger.error('Handle reservation confirmed error:', error);
  }
};

// Initialize
const init = async () => {
  try {
    // Database
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    logger.info('Database connected');

    // RabbitMQ
    await connectRabbitMQ();
    
    const channel = getChannel();
    if (channel) {
      // Start listening for Saga messages
      channel.consume(SAGA_QUEUE, handleSagaCompensation);
      
      // Listen for inventory.reservation_confirmed
      await channel.assertQueue('inventory-confirmation', { durable: true });
      await channel.bindQueue('inventory-confirmation', 'inventory-events', 'stock.reservation_confirmed');
      channel.consume('inventory-confirmation', handleInventoryReservationConfirmed);
    }

    // Start server
    app.listen(PORT, async () => {
      logger.info(`Order service running on port ${PORT}`);
      await registerWithConsul();
    });
  } catch (error) {
    logger.error('Initialization failed:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down order service...');
  await sequelize.close();
  const channel = getChannel();
  if (channel) {
    await channel.close();
  }
  process.exit(0);
});

// Export for testing
module.exports = { app, init };

// Start if run directly
if (require.main === module) {
  init();
}
