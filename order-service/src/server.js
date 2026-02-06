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


app.use(helmet());
app.use(express.json());


app.use('/api/v1/orders', orderRoutes);


app.use(notFoundHandler);
app.use(errorMiddleware);


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


const handleSagaCompensation = async (msg) => {
  try {
    const event = JSON.parse(msg.content.toString());
    
    if (event.event === 'INVENTORY_CHECK_FAILED') {
      
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


const init = async () => {
  try {
    
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    logger.info('Database connected');

    
    await connectRabbitMQ();
    
    const channel = getChannel();
    if (channel) {
      
      channel.consume(SAGA_QUEUE, handleSagaCompensation);
      
      
      await channel.assertQueue('inventory-confirmation', { durable: true });
      await channel.bindQueue('inventory-confirmation', 'inventory-events', 'stock.reservation_confirmed');
      channel.consume('inventory-confirmation', handleInventoryReservationConfirmed);
    }

    
    app.listen(PORT, async () => {
      logger.info(`Order service running on port ${PORT}`);
      await registerWithConsul();
    });
  } catch (error) {
    logger.error('Initialization failed:', error);
    process.exit(1);
  }
};


process.on('SIGTERM', async () => {
  logger.info('Shutting down order service...');
  await sequelize.close();
  const channel = getChannel();
  if (channel) {
    await channel.close();
  }
  process.exit(0);
});


module.exports = { app, init };


if (require.main === module) {
  init();
}
