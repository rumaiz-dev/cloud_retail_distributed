const express = require('express');
require('express-async-errors');
const { Sequelize, DataTypes, Op } = require('sequelize');
const amqp = require('amqplib');
const axios = require('axios');
const winston = require('winston');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const consul = require('consul');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3003;

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/order-service.log' })
  ]
});

// Database
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

// Models
const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderNumber: {
    type: DataTypes.STRING,
    unique: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded'
    ),
    defaultValue: 'pending'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  shippingAddress: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  billingAddress: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: false
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
    defaultValue: 'pending'
  },
  items: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  notes: DataTypes.TEXT,
  estimatedDelivery: DataTypes.DATE,
  trackingNumber: DataTypes.STRING
}, {
  timestamps: true,
  hooks: {
    beforeCreate: async (order) => {
      if (!order.orderNumber) {
        const date = new Date();
        const timestamp = date.getTime();
        const random = Math.floor(Math.random() * 1000);
        order.orderNumber = `ORD-${timestamp}-${random}`;
      }
    }
  }
});

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  productId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    min: 1
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }
});

Order.hasMany(OrderItem, { foreignKey: 'orderId' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

// RabbitMQ
let channel = null;
const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq');
    channel = await connection.createChannel();
    
    await channel.assertExchange('order-events', 'topic', { durable: true });
    
    // Declare queues for Saga pattern
    await channel.assertQueue('order-saga', { durable: true });
    await channel.bindQueue('order-saga', 'order-events', 'order.*');
    
    logger.info('Connected to RabbitMQ');
  } catch (error) {
    logger.error('RabbitMQ connection error:', error);
    setTimeout(connectRabbitMQ, 5000);
  }
};

// Validation
const createOrderSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    productId: Joi.string().required(),
    sku: Joi.string().required(),
    name: Joi.string().required(),
    quantity: Joi.number().min(1).required(),
    price: Joi.number().min(0).required()
  })).min(1).required(),
  shippingAddress: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
    postalCode: Joi.string().required()
  }).required(),
  billingAddress: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
    postalCode: Joi.string().required()
  }).required(),
  paymentMethod: Joi.string().required(),
  notes: Joi.string()
});

// Middleware
app.use(helmet());
app.use(express.json());

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: 'healthy',
      service: 'order-service',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    // Verify token with user service
    const response = await axios.get(`${process.env.USER_SERVICE_URL}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    req.user = response.data;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Create order with Saga pattern
app.post('/', authenticate, async (req, res) => {
  const { error } = createOrderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const transaction = await sequelize.transaction();

  try {
    // Calculate total
    const totalAmount = req.body.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    // Create order
    const order = await Order.create({
      userId: req.user.id,
      totalAmount,
      shippingAddress: req.body.shippingAddress,
      billingAddress: req.body.billingAddress,
      paymentMethod: req.body.paymentMethod,
      items: req.body.items,
      notes: req.body.notes
    }, { transaction });

    // Create order items
    await OrderItem.bulkCreate(
      req.body.items.map(item => ({
        orderId: order.id,
        ...item,
        subtotal: item.price * item.quantity
      })),
      { transaction }
    );

    // Publish order created event (Start Saga)
    if (channel) {
      channel.publish('order-events', 'order.created', Buffer.from(JSON.stringify({
        event: 'ORDER_CREATED',
        orderId: order.id,
        userId: order.userId,
        items: req.body.items,
        totalAmount: order.totalAmount,
        timestamp: new Date().toISOString()
      })));
    }

    await transaction.commit();

    logger.info(`Order created: ${order.orderNumber}`);

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Create order error:', error);
    throw error;
  }
});

// Get user orders
app.get('/', authenticate, async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  
  const where = { userId: req.user.id };
  if (status) {
    where.status = status;
  }

  const orders = await Order.findAndCountAll({
    where,
    include: [OrderItem],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: (page - 1) * limit
  });

  res.json({
    total: orders.count,
    page: parseInt(page),
    limit: parseInt(limit),
    orders: orders.rows
  });
});

// Get order by ID
app.get('/:id', authenticate, async (req, res) => {
  const order = await Order.findOne({
    where: {
      id: req.params.id,
      userId: req.user.id
    },
    include: [OrderItem]
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json(order);
});

// Update order status (admin only)
app.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const order = await Order.findByPk(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  await order.update({ status });

  // Publish status update event
  if (channel) {
    channel.publish('order-events', 'order.status.updated', Buffer.from(JSON.stringify({
      event: 'ORDER_STATUS_UPDATED',
      orderId: order.id,
      userId: order.userId,
      oldStatus: order.previous('status'),
      newStatus: status,
      timestamp: new Date().toISOString()
    })));
  }

  res.json({
    message: 'Order status updated',
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status
    }
  });
});

// Cancel order
app.post('/:id/cancel', authenticate, async (req, res) => {
  const order = await Order.findOne({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (!['pending', 'confirmed'].includes(order.status)) {
    return res.status(400).json({ 
      error: 'Order cannot be cancelled in current status' 
    });
  }

  await order.update({ status: 'cancelled' });

  // Publish cancellation event
  if (channel) {
    channel.publish('order-events', 'order.cancelled', Buffer.from(JSON.stringify({
      event: 'ORDER_CANCELLED',
      orderId: order.id,
      userId: order.userId,
      items: order.items,
      timestamp: new Date().toISOString()
    })));
  }

  res.json({ message: 'Order cancelled successfully' });
});

// Saga compensation handler (example)
const handleSagaCompensation = async (msg) => {
  try {
    const event = JSON.parse(msg.content.toString());
    
    if (event.event === 'INVENTORY_CHECK_FAILED') {
      // Compensate by cancelling the order
      await Order.update(
        { status: 'cancelled' },
        { where: { id: event.orderId } }
      );
      logger.info(`Compensated order ${event.orderId} due to inventory failure`);
    }
    
    channel.ack(msg);
  } catch (error) {
    logger.error('Saga compensation error:', error);
  }
};

// Consul registration
const registerWithConsul = async () => {
  const consulClient = new consul({ host: 'consul', port: 8500 });
  
  await consulClient.agent.service.register({
    name: 'order-service',
    address: 'order-service',
    port: parseInt(PORT),
    check: {
      http: `http://order-service:${PORT}/health`,
      interval: '10s',
      timeout: '5s'
    }
  });
  
  logger.info('Registered order-service with Consul');
};

// Initialize
const init = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    logger.info('Database connected');

    await connectRabbitMQ();

    // Start listening for Saga messages
    if (channel) {
      channel.consume('order-saga', handleSagaCompensation);
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

init();

process.on('SIGTERM', async () => {
  logger.info('Shutting down order service...');
  await sequelize.close();
  if (channel) {
    await channel.close();
  }
  process.exit(0);
});

module.exports = app;