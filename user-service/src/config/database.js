const { Sequelize } = require('sequelize');
const redis = require('redis');
const amqp = require('amqplib');

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

// Redis client for caching
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`
});

redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect();

// RabbitMQ connection with reconnect logic
let channel = null;

const connectRabbitMQ = async (logger) => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq');
    channel = await connection.createChannel();
    
    // Declare exchanges
    await channel.assertExchange('user-events', 'topic', { durable: true });
    await channel.assertExchange('auth-events', 'topic', { durable: true });
    
    logger.info('Connected to RabbitMQ');
  } catch (error) {
    logger.error('RabbitMQ connection error:', error);
    setTimeout(() => connectRabbitMQ(logger), 5000);
  }
};

const getRabbitChannel = () => channel;

// Publish events to RabbitMQ
const publishEvent = (exchange, routingKey, event, logger) => {
  if (channel) {
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
      service: 'user-service'
    })));
    logger.debug(`Event published: ${exchange}.${routingKey}`);
  }
};

module.exports = {
  sequelize,
  redisClient,
  connectRabbitMQ,
  getRabbitChannel,
  publishEvent
};
