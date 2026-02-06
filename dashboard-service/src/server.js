require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const dashboardRoutes = require('./routes/dashboard.routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const logger = require('./utils/logger');
const cacheClient = require('./services/cache.client');

const app = express();
const PORT = process.env.PORT || 3005;


app.use(helmet({
  contentSecurityPolicy: false
}));


app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});


app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.requestId
    });
  });
  next();
});


app.use('/api/v1/dashboard', dashboardRoutes);


app.get('/', (req, res) => {
  res.json({
    service: 'dashboard-service',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});


app.use(errorHandler);


app.use(notFoundHandler);


const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  try {
    // Disconnect from Redis
    await cacheClient.disconnect();
    logger.info('Redis connection closed');
    
    // Close the server
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};


const startServer = async () => {
  try {
    
    try {
      await cacheClient.connect();
    } catch (error) {
      logger.warn('Redis connection failed, running without cache:', error.message);
    }

    // Start the server
    const server = app.listen(PORT, () => {
      logger.info(`Dashboard service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app;
