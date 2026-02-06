require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const consul = require('consul');


const { sequelize, connectRabbitMQ } = require('./config/database');
const logger = require('./utils/logger');
const authRoutes = require('./routes/auth.routes');
const { errorMiddleware, notFoundHandler } = require('./middlewares/error.middleware');


require('./models/user.model');

const app = express();
const PORT = process.env.PORT || 3001;


app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:8080', credentials: true }));
app.use(helmet());
app.use(express.json());


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


app.use('/api/v1/auth', authRoutes);


app.use(notFoundHandler);
app.use(errorMiddleware);


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


const startServer = async () => {
  try {
    
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    logger.info('Database connected and synced');

    
    await connectRabbitMQ(logger);

    
    app.listen(PORT, async () => {
      logger.info(`User service running on port ${PORT}`);
      
      
      await registerWithConsul();
    });
  } catch (error) {
    logger.error('Initialization failed:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
