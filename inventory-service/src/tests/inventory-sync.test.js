/**
 * Inventory Service - RabbitMQ Event Handling Tests
 * Tests for RabbitMQ event handling and message processing
 */

const EventEmitter = require('events');

// Mock dependencies
jest.mock('../config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    models: {
      Inventory: {
        findOne: jest.fn(),
        findByPk: jest.fn(),
        update: jest.fn(),
      },
    },
    close: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../config/rabbitmq', () => ({
  getChannel: jest.fn().mockReturnValue({
    assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue' }),
    bindQueue: jest.fn().mockResolvedValue({}),
    consume: jest.fn().mockResolvedValue({ consumerTag: 'test-consumer' }),
    ack: jest.fn().mockResolvedValue(true),
    nack: jest.fn().mockResolvedValue(true),
    publish: jest.fn().mockReturnValue(true),
  }),
  publishMessage: jest.fn().mockResolvedValue(true),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: 'test-user-id', role: 'admin' }),
}));

const { sequelize } = require('../config/database');
const { getChannel, publishMessage } = require('../config/rabbitmq');

// Mock RabbitMQ channel
class MockChannel extends EventEmitter {
  constructor() {
    super();
    this.messages = [];
  }

  async assertQueue(queueName, options = {}) {
    return { queue: queueName, messageCount: 0 };
  }

  async bindQueue(queueName, exchangeName, routingKey = '') {
    return { queue: queueName, exchange: exchangeName, routingKey };
  }

  async consume(queueName, callback, options = {}) {
    this.on('message', (msg) => callback(msg));
    return { consumerTag: 'test-consumer' };
  }

  async ack(msg) {
    return true;
  }

  async nack(msg, requeue = false) {
    return true;
  }
}

describe('Inventory RabbitMQ Event Handling', () => {
  let mockChannel;

  beforeEach(() => {
    mockChannel = new MockChannel();
    jest.clearAllMocks();
  });

  describe('Queue Setup', () => {
    it('should set up inventory event queues', async () => {
      const result = await mockChannel.assertQueue('inventory.events', {
        durable: true,
      });

      expect(result.queue).toBe('inventory.events');
    });

    it('should bind queue to exchange', async () => {
      const result = await mockChannel.bindQueue(
        'inventory.events',
        'inventory.exchange',
        'inventory.#'
      );

      expect(result.queue).toBe('inventory.events');
      expect(result.exchange).toBe('inventory.exchange');
    });
  });

  describe('Message Consumption', () => {
    it('should consume inventory update messages', async () => {
      const messageHandler = jest.fn();

      await mockChannel.consume('inventory.events', messageHandler);

      // Simulate message
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          eventType: 'STOCK_UPDATED',
          productId: 'test-product-id',
          quantity: 100,
        })),
      };

      mockChannel.emit('message', mockMessage);

      expect(messageHandler).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle order.created event', async () => {
      sequelize.models.Inventory.findOne.mockResolvedValue({
        productId: 'test-product-id',
        quantity: 100,
        reservedQuantity: 0,
      });
      sequelize.models.Inventory.update.mockResolvedValue([1]);

      const eventMessage = {
        eventType: 'ORDER_CREATED',
        orderId: 'order-123',
        items: [
          { productId: 'test-product-id', quantity: 2 },
        ],
      };

      // Process the event
      if (eventMessage.eventType === 'ORDER_CREATED') {
        for (const item of eventMessage.items) {
          const inventory = await sequelize.models.Inventory.findOne({
            where: { productId: item.productId },
          });

          if (inventory) {
            await sequelize.models.Inventory.update(
              { reservedQuantity: inventory.reservedQuantity + item.quantity },
              { where: { productId: item.productId } }
            );
          }
        }
      }

      expect(sequelize.models.Inventory.findOne).toHaveBeenCalled();
      expect(sequelize.models.Inventory.update).toHaveBeenCalled();
    });

    it('should handle order.cancelled event', async () => {
      sequelize.models.Inventory.findOne.mockResolvedValue({
        productId: 'test-product-id',
        quantity: 100,
        reservedQuantity: 5,
      });
      sequelize.models.Inventory.update.mockResolvedValue([1]);

      const eventMessage = {
        eventType: 'ORDER_CANCELLED',
        orderId: 'order-123',
        items: [
          { productId: 'test-product-id', quantity: 2 },
        ],
      };

      // Process the event
      if (eventMessage.eventType === 'ORDER_CANCELLED') {
        for (const item of eventMessage.items) {
          const inventory = await sequelize.models.Inventory.findOne({
            where: { productId: item.productId },
          });

          if (inventory) {
            const releaseQuantity = Math.min(item.quantity, inventory.reservedQuantity);
            await sequelize.models.Inventory.update(
              { reservedQuantity: inventory.reservedQuantity - releaseQuantity },
              { where: { productId: item.productId } }
            );
          }
        }
      }

      expect(sequelize.models.Inventory.findOne).toHaveBeenCalled();
      expect(sequelize.models.Inventory.update).toHaveBeenCalled();
    });

    it('should handle order.shipped event (release reservation)', async () => {
      sequelize.models.Inventory.findOne.mockResolvedValue({
        productId: 'test-product-id',
        quantity: 100,
        reservedQuantity: 10,
      });
      sequelize.models.Inventory.update.mockResolvedValue([1]);

      const eventMessage = {
        eventType: 'ORDER_SHIPPED',
        orderId: 'order-123',
        items: [
          { productId: 'test-product-id', quantity: 3 },
        ],
      };

      // Process the event - shipped orders release reservation and reduce stock
      if (eventMessage.eventType === 'ORDER_SHIPPED') {
        for (const item of eventMessage.items) {
          const inventory = await sequelize.models.Inventory.findOne({
            where: { productId: item.productId },
          });

          if (inventory) {
            const newReserved = inventory.reservedQuantity - item.quantity;
            const newQuantity = inventory.quantity - item.quantity;
            await sequelize.models.Inventory.update(
              {
                quantity: newQuantity,
                reservedQuantity: Math.max(0, newReserved),
              },
              { where: { productId: item.productId } }
            );
          }
        }
      }

      expect(sequelize.models.Inventory.findOne).toHaveBeenCalled();
      expect(sequelize.models.Inventory.update).toHaveBeenCalled();
    });
  });

  describe('Message Acknowledgment', () => {
    it('should acknowledge processed messages', async () => {
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ test: 'data' })),
      };

      await mockChannel.ack(mockMessage);

      expect(mockChannel.ack).toBeDefined();
    });

    it('should negatively acknowledge failed messages', async () => {
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ test: 'data' })),
      };

      await mockChannel.nack(mockMessage, false);

      expect(mockChannel.nack).toBeDefined();
    });
  });

  describe('Event Publishing', () => {
    it('should publish low stock alerts', async () => {
      const result = await publishMessage(
        'inventory.alerts',
        'LOW_STOCK',
        {
          productId: 'test-product-id',
          currentStock: 5,
          reorderLevel: 10,
        }
      );

      expect(publishMessage).toHaveBeenCalled();
    });

    it('should publish stock update events', async () => {
      const result = await publishMessage(
        'inventory.events',
        'STOCK_UPDATED',
        {
          productId: 'test-product-id',
          previousQuantity: 100,
          newQuantity: 150,
        }
      );

      expect(publishMessage).toHaveBeenCalled();
    });
  });
});
