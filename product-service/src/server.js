const express = require('express');
const mongoose = require('mongoose');
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

// MongoDB connection
mongoose.connect(`mongodb://${process.env.DB_HOST || 'mongodb'}:27017/products`, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Redis client for caching
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:6379`
});

redisClient.on('error', (err) => logger.error('Redis error:', err));
redisClient.connect();

// Product Schema
const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true
  },
  tags: [String],
  stock: {
    type: Number,
    required: true,
    default: 0
  },
  images: [String],
  specifications: Map,
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Product = mongoose.model('Product', productSchema);

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
  specifications: Joi.object()
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
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
  
  res.json({
    status: 'healthy',
    service: 'product-service',
    timestamp: new Date().toISOString(),
    databases: {
      mongodb: mongoStatus,
      redis: redisStatus
    }
  });
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
    const query = { isActive: true };
    
    if (category) {
      query.category = category;
    }

    const products = await Product.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

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

    const product = await Product.findById(req.params.id);
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

    const product = new Product(req.body);
    await product.save();

    // Clear cache
    await redisClient.del('products:all');

    // Publish event
    if (channel) {
      channel.publish('product-events', 'product.created', Buffer.from(JSON.stringify({
        event: 'PRODUCT_CREATED',
        productId: product._id,
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
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Clear cache
    await redisClient.del(`product:${req.params.id}`);
    await redisClient.del('products:all');

    // Publish event
    if (channel) {
      channel.publish('product-events', 'product.updated', Buffer.from(JSON.stringify({
        event: 'PRODUCT_UPDATED',
        productId: product._id,
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
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Clear cache
    await redisClient.del(`product:${req.params.id}`);
    await redisClient.del('products:all');

    // Publish event
    if (channel) {
      channel.publish('product-events', 'product.deleted', Buffer.from(JSON.stringify({
        event: 'PRODUCT_DELETED',
        productId: product._id,
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
    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ],
      isActive: true
    }).limit(20);

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
    await mongoose.connection.once('open', () => {
      logger.info('MongoDB connected');
    });

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
  await mongoose.connection.close();
  await redisClient.quit();
  if (channel) {
    await channel.close();
  }
  process.exit(0);
});

module.exports = app;