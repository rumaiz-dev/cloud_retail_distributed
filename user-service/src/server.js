require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const consul = require('consul');

// Import modules
const { sequelize, connectRabbitMQ } = require('./config/database');
const logger = require('./utils/logger');
const authRoutes = require('./routes/auth.routes');
const { errorMiddleware, notFoundHandler } = require('./middlewares/error.middleware');

// Import models to sync
require('./models/user.model');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: 'healthy',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'user-service',
      error: error.message
    });
  }
});

// API routes
app.use('/api/v1/auth', authRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorMiddleware);

// Service registration with Consul
const registerWithConsul = async () => {
  const consulClient = new consul({ 
    host: process.env.CONSUL_HOST || 'consul', 
    port: process.env.CONSUL_PORT || 8500 
  });
  
  await consulClient.agent.service.register({
    name: 'user-service',
    address: 'user-service',
    port: parseInt(PORT),
    check: {
      http: `http://user-service:${PORT}/health`,
      interval: '10s',
      timeout: '5s'
    }
  });
  
  logger.info('Registered user-service with Consul');
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down user service...`);
  
  try {
    await sequelize.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize and start server
const startServer = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    logger.info('Database connected and synced');

    // Connect to RabbitMQ
    await connectRabbitMQ(logger);

    // Start server
    app.listen(PORT, async () => {
      logger.info(`User service running on port ${PORT}`);
      
      // Register with Consul
      await registerWithConsul();
    });
  } catch (error) {
    logger.error('Initialization failed:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
