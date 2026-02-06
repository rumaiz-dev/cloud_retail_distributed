/**
 * RabbitMQ Mock Helper
 * Provides mock RabbitMQ client for unit testing
 */

const EventEmitter = require('events');

// Mock RabbitMQ channel for testing
class MockRabbitMQChannel extends EventEmitter {
  constructor() {
    super();
    this.messages = [];
    this.subscriptions = new Map();
    this.assertedQueues = new Map();
    this.assertedExchanges = new Map();
    this.publishedMessages = [];
  }

  async assertQueue(queueName, options = {}) {
    this.assertedQueues.set(queueName, { options, messageCount: 0, consumerCount: 0 });
    return { queue: queueName, messageCount: 0, consumerCount: 0 };
  }

  async assertExchange(exchangeName, type, options = {}) {
    this.assertedExchanges.set(exchangeName, { type, options });
    return { exchange: exchangeName, type };
  }

  async bindQueue(queueName, exchangeName, routingKey = '') {
    const queue = this.assertedQueues.get(queueName);
    if (queue) {
      queue.bindings = queue.bindings || [];
      queue.bindings.push({ exchange: exchangeName, routingKey });
    }
    return { queue: queueName, exchange: exchangeName, routingKey };
  }

  async sendToQueue(queueName, content, options = {}) {
    const message = {
      content: Buffer.isBuffer(content) ? content.toString() : content,
      options,
      queue: queueName,
      timestamp: Date.now(),
    };
    this.publishedMessages.push(message);
    const queue = this.assertedQueues.get(queueName);
    if (queue) {
      queue.messageCount++;
    }
    return true;
  }

  async publish(exchangeName, routingKey, content, options = {}) {
    const message = {
      content: Buffer.isBuffer(content) ? content.toString() : content,
      options,
      exchange: exchangeName,
      routingKey,
      timestamp: Date.now(),
    };
    this.publishedMessages.push(message);
    return true;
  }

  async consume(queueName, callback, options = {}) {
    const consumerTag = `consumer-${Date.now()}`;
    this.subscriptions.set(consumerTag, { queueName, callback, options });
    return { consumerTag };
  }

  async ack(message) {
    return true;
  }

  async nack(message, requeue = false) {
    return true;
  }

  async ackAll() {
    return true;
  }

  async nackAll(requeue = false) {
    return true;
  }

  async deleteQueue(queueName) {
    this.assertedQueues.delete(queueName);
    return { queue: queueName, messageCount: 0 };
  }

  async deleteExchange(exchangeName) {
    this.assertedExchanges.delete(exchangeName);
    return { exchange: exchangeName };
  }

  async cancel(consumerTag) {
    this.subscriptions.delete(consumerTag);
    return { consumerTag };
  }

  async prefetch(count) {
    return true;
  }

  async close() {
    this.emit('close');
    return true;
  }

  reset() {
    this.messages = [];
    this.subscriptions.clear();
    this.assertedQueues.clear();
    this.assertedExchanges.clear();
    this.publishedMessages = [];
  }
}

// Mock RabbitMQ connection for testing
class MockRabbitMQConnection extends EventEmitter {
  constructor() {
    super();
    this.channels = [];
    this.isConnected = true;
  }

  async createChannel() {
    const channel = new MockRabbitMQChannel();
    this.channels.push(channel);
    return channel;
  }

  async close() {
    this.isConnected = false;
    this.emit('close');
    return true;
  }

  reset() {
    this.channels.forEach(ch => ch.reset());
    this.channels = [];
  }
}

// Create a mock RabbitMQ connection
const createMockRabbitMQConnection = () => {
  return new MockRabbitMQConnection();
};

// Mock amqplib for testing
const mockAmqplib = {
  connect: jest.fn(async () => createMockRabbitMQConnection()),
};

module.exports = {
  MockRabbitMQChannel,
  MockRabbitMQConnection,
  createMockRabbitMQConnection,
  mockAmqplib,
};
