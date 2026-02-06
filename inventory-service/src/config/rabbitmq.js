/**
 * RabbitMQ Configuration for Inventory Service
 */

const amqp = require('amqplib');

let channel = null;

const connectRabbitMQ = async (logger) => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq');
    channel = await connection.createChannel();
    
    await channel.assertExchange('inventory.events', 'topic', { durable: true });
    await channel.assertExchange('inventory.alerts', 'fanout', { durable: true });
    
    logger.info('Connected to RabbitMQ');
  } catch (error) {
    logger.error('RabbitMQ connection error:', error);
    setTimeout(() => connectRabbitMQ(logger), 5000);
  }
};

const getChannel = () => channel;

const publishMessage = (exchange, routingKey, event, logger) => {
  if (channel) {
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
      service: 'inventory-service'
    })));
    logger.debug(`Message published: ${exchange}.${routingKey}`);
  }
};

module.exports = {
  connectRabbitMQ,
  getChannel,
  publishMessage
};
