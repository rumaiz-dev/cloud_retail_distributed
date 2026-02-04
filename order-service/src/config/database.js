const { Sequelize } = require('sequelize');
const amqp = require('amqplib');
const logger = require('../utils/logger');

// PostgreSQL connection via Sequelize
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

// RabbitMQ connection with reconnect logic
let channel = null;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin123@rabbitmq';
const ORDER_EXCHANGE = 'order-events';
const SAGA_QUEUE = 'order-saga';

const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Declare order events exchange
    await channel.assertExchange(ORDER_EXCHANGE, 'topic', { durable: true });

    // Declare queue for Saga pattern
    await channel.assertQueue(SAGA_QUEUE, { durable: true });
    await channel.bindQueue(SAGA_QUEUE, ORDER_EXCHANGE, 'order.*');

    logger.info('Connected to RabbitMQ');
    return channel;
  } catch (error) {
    logger.error('RabbitMQ connection error:', error);
    setTimeout(() => connectRabbitMQ(), 5000);
  }
};

// Publish event to RabbitMQ
const publishEvent = (routingKey, event) => {
  try {
    if (channel) {
      channel.publish(ORDER_EXCHANGE, routingKey, Buffer.from(JSON.stringify({
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

// Get RabbitMQ URL (for external use)
const getRabbitMQUrl = () => RABBITMQ_URL;

module.exports = {
  sequelize,
  connectRabbitMQ,
  publishEvent,
  getChannel,
  getRabbitMQUrl,
  ORDER_EXCHANGE,
  SAGA_QUEUE
};
