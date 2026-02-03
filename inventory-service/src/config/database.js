const { Sequelize } = require('sequelize');
const amqplib = require('amqplib');
const logger = require('../utils/logger');

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

let channel = null;
const QUEUE_NAME = 'inventory-order-events';

// RabbitMQ connection
const connectRabbitMQ = async () => {
  try {
    // Build RabbitMQ URL with credentials from environment
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin123@rabbitmq';
    const connection = await amqplib.connect(rabbitmqUrl);
    channel = await connection.createChannel();

    // Declare exchanges
    await channel.assertExchange('inventory-events', 'topic', { durable: true });
    await channel.assertExchange('order-events', 'topic', { durable: true });

    // Declare queue for order events
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await channel.bindQueue(QUEUE_NAME, 'order-events', 'order.created');
    await channel.bindQueue(QUEUE_NAME, 'order-events', 'order.cancelled');

    logger.info('RabbitMQ connected');
    return channel;
  } catch (error) {
    logger.error('RabbitMQ connection error:', error);
    throw error;
  }
};

// Publish event to RabbitMQ
const publishEvent = async (exchange, routingKey, event) => {
  try {
    if (channel) {
      channel.publish(exchange, routingKey, Buffer.from(JSON.stringify({
        ...event,
        timestamp: new Date().toISOString()
      })));
      logger.info(`Published event: ${routingKey}`);
    }
  } catch (error) {
    logger.error('Failed to publish event:', error);
  }
};

// Get RabbitMQ channel
const getChannel = () => channel;

// Initialize all connections
const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('PostgreSQL connected');
    await sequelize.sync();
    return sequelize;
  } catch (error) {
    logger.error('Database connection error:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  connectRabbitMQ,
  publishEvent,
  getChannel,
  initDatabase,
  QUEUE_NAME
};
