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
  url: `redis://${process.env.REDIS_HOST || 'redis'}:6379`
});

redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect();

// RabbitMQ connection with reconnect logic
let channel = null;

const connectRabbitMQ = async (logger) => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq');
    channel = await connection.createChannel();
    
    await channel.assertExchange('product-events', 'topic', { durable: true });
    
    logger.info('Connected to RabbitMQ');
  } catch (error) {
    logger.error('RabbitMQ connection error:', error);
    setTimeout(() => connectRabbitMQ(logger), 5000);
  }
};

const getRabbitChannel = () => channel;

module.exports = {
  sequelize,
  redisClient,
  connectRabbitMQ,
  getRabbitChannel
};
