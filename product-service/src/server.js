require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const consul = require('consul');

const logger = require('./utils/logger');
const { sequelize, redisClient, connectRabbitMQ } = require('./config/database');
const Product = require('./models/product.model');
const productRoutes = require('./routes/product.routes');
const { errorMiddleware, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:8080',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Routes
app.use('/api/v1/products', productRoutes);

// Health check (at root level)
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

// Error handling
app.use(notFoundHandler);
app.use(errorMiddleware);

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

    await sequelize.sync({ alter: true });
    logger.info('Product model synchronized');

    await connectRabbitMQ(logger);

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

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down product service...');
  await sequelize.close();
  await redisClient.quit();
  process.exit(0);
});

module.exports = app;
