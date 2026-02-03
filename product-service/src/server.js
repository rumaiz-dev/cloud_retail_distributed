const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const amqp = require('amqplib');
const winston = require('winston');
const redis = require('redis');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const consul = require('consul');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3002;

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/product-service.log' })
  ]
});

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

// Product Model
const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sku: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING)
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  images: {
    type: DataTypes.ARRAY(DataTypes.STRING)
  },
  specifications: {
    type: DataTypes.JSONB
  },
  attributes: {
    type: DataTypes.JSONB
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

// Redis client for caching
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:6379`
});

redisClient.on('error', (err) => logger.error('Redis error:', err));
redisClient.connect();

// RabbitMQ
let channel = null;
const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq');
    channel = await connection.createChannel();
    
    await channel.assertExchange('product-events', 'topic', { durable: true });
    
    logger.info('Connected to RabbitMQ');
  } catch (error) {
    logger.error('RabbitMQ connection error:', error);
    setTimeout(connectRabbitMQ, 5000);
  }
};

// Validation schemas
const createProductSchema = Joi.object({
  sku: Joi.string().required(),
  name: Joi.string().required().min(3),
  description: Joi.string(),
  price: Joi.number().min(0).required(),
  category: Joi.string().required(),
  tags: Joi.array().items(Joi.string()),
  stock: Joi.number().min(0).required(),
  images: Joi.array().items(Joi.string()),
  specifications: Joi.object(),
  attributes: Joi.object()
});

// Middleware
app.use(helmet());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Health check
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    const postgresStatus = 'connected';
    const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
    
    res.json({
      status: 'healthy',
      service: 'product-service',
      timestamp: new Date().toISOString(),
      databases: {
        postgres: postgresStatus,
        redis: redisStatus
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'product-service',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Get all products with caching
app.get('/', async (req, res) => {
  try {
    const cacheKey = `products:${req.query.category || 'all'}`;
    
    // Try cache first
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const { category, page = 1, limit = 20, sort = 'createdAt' } = req.query;
    const where = { isActive: true };
    
    if (category) {
      where.category = category;
    }

    const products = await Product.findAll({
      where,
      order: [[sort, 'ASC']],
      offset: (page - 1) * limit,
      limit: parseInt(limit)
    });

    // Cache for 5 minutes
    await redisClient.setEx(cacheKey, 300, JSON.stringify(products));

    res.json(products);
  } catch (error) {
    logger.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product
app.get('/:id', async (req, res) => {
  try {
    const cacheKey = `product:${req.params.id}`;
    
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await redisClient.setEx(cacheKey, 300, JSON.stringify(product));
    res.json(product);
  } catch (error) {
    logger.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create product
app.post('/', async (req, res) => {
  try {
    const { error } = createProductSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const product = await Product.create(req.body);

    // Clear cache
    await redisClient.del('products:all');

    // Publish event
    if (channel) {
      channel.publish('product-events', 'product.created', Buffer.from(JSON.stringify({
        event: 'PRODUCT_CREATED',
        productId: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        timestamp: new Date().toISOString()
      })));
    }

    logger.info(`Product created: ${product.sku}`);
    
    res.status(201).json(product);
  } catch (error) {
    logger.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
app.put('/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await product.update(req.body);

    // Clear cache
    await redisClient.del(`product:${req.params.id}`);
    await redisClient.del('products:all');

    // Publish event
    if (channel) {
      channel.publish('product-events', 'product.updated', Buffer.from(JSON.stringify({
        event: 'PRODUCT_UPDATED',
        productId: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        timestamp: new Date().toISOString()
      })));
    }

    res.json(product);
  } catch (error) {
    logger.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product (soft delete)
app.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await product.update({ isActive: false });

    // Clear cache
    await redisClient.del(`product:${req.params.id}`);
    await redisClient.del('products:all');

    // Publish event
    if (channel) {
      channel.publish('product-events', 'product.deleted', Buffer.from(JSON.stringify({
        event: 'PRODUCT_DELETED',
        productId: product.id,
        sku: product.sku,
        timestamp: new Date().toISOString()
      })));
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    logger.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Search products
app.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const products = await Product.findAll({
      where: {
        [Sequelize.Op.or]: [
          { name: { [Sequelize.Op.iLike]: `%${query}%` } },
          { description: { [Sequelize.Op.iLike]: `%${query}%` } },
          { tags: { [Sequelize.Op.contains]: [query] } }
        ],
        isActive: true
      },
      limit: 20
    });

    res.json(products);
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Consul registration
const registerWithConsul = async () => {
  const consulClient = new consul({ host: 'consul', port: 8500 });
  
  await consulClient.agent.service.register({
    name: 'product-service',
    address: 'product-service',
    port: parseInt(PORT),
    check: {
      http: `http://product-service:${PORT}/health`,
      interval: '10s',
      timeout: '5s'
    }
  });
  
  logger.info('Registered product-service with Consul');
};

// Initialize
const init = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Product Service: PostgreSQL connected');

    await sequelize.sync();
    logger.info('Product model synchronized');

    await connectRabbitMQ();

    app.listen(PORT, async () => {
      logger.info(`Product service running on port ${PORT}`);
      await registerWithConsul();
    });
  } catch (error) {
    logger.error('Initialization failed:', error);
    process.exit(1);
  }
};

init();

process.on('SIGTERM', async () => {
  logger.info('Shutting down product service...');
  await sequelize.close();
  await redisClient.quit();
  if (channel) {
    await channel.close();
  }
  process.exit(0);
});

module.exports = app;
