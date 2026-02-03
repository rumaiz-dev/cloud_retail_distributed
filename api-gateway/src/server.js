const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const winston = require('winston');
const consul = require('consul');
const jwt = require('jsonwebtoken');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/api-gateway.log' })
  ]
});

// Service discovery
const consulClient = new consul({ host: 'consul', port: 8500 });

// Service registry
const services = {
  user: 'http://user-service:3001',
  product: 'http://product-service:3002',
  order: 'http://order-service:3003',
  inventory: 'http://inventory-service:3004'
};

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', apiLimiter);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Service health checks
const healthChecks = async () => {
  const health = {};
  for (const [service, url] of Object.entries(services)) {
    try {
      const response = await fetch(`${url}/health`);
      health[service] = response.ok ? 'healthy' : 'unhealthy';
    } catch (error) {
      health[service] = 'unreachable';
      logger.error(`Health check failed for ${service}: ${error.message}`);
    }
  }
  return health;
};

// Routes
app.get('/health', async (req, res) => {
  const servicesHealth = await healthChecks();
  const overallHealth = Object.values(servicesHealth).every(s => s === 'healthy');
  
  res.status(overallHealth ? 200 : 503).json({
    status: overallHealth ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: servicesHealth
  });
});

// API Documentation
const swaggerDocument = YAML.load('./swagger.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Service proxies
app.use('/api/users', authenticateToken, createProxyMiddleware({
  target: services.user,
  changeOrigin: true,
  pathRewrite: { '^/api/users': '/' },
  onError: (err, req, res) => {
    logger.error(`User service error: ${err.message}`);
    res.status(503).json({ error: 'User service temporarily unavailable' });
  }
}));

app.use('/api/products', createProxyMiddleware({
  target: services.product,
  changeOrigin: true,
  pathRewrite: { '^/api/products': '/' },
  onError: (err, req, res) => {
    logger.error(`Product service error: ${err.message}`);
    res.status(503).json({ error: 'Product service temporarily unavailable' });
  }
}));

app.use('/api/orders', authenticateToken, createProxyMiddleware({
  target: services.order,
  changeOrigin: true,
  pathRewrite: { '^/api/orders': '/' },
  onError: (err, req, res) => {
    logger.error(`Order service error: ${err.message}`);
    res.status(503).json({ error: 'Order service temporarily unavailable' });
  }
}));

app.use('/api/inventory', authenticateToken, createProxyMiddleware({
  target: services.inventory,
  changeOrigin: true,
  pathRewrite: { '^/api/inventory': '/' },
  onError: (err, req, res) => {
    logger.error(`Inventory service error: ${err.message}`);
    res.status(503).json({ error: 'Inventory service temporarily unavailable' });
  }
}));

// Auth endpoints
app.post('/api/auth/register', createProxyMiddleware({
  target: services.user,
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '/auth' }
}));

app.post('/api/auth/login', createProxyMiddleware({
  target: services.user,
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '/auth' }
}));

// Register services with Consul
const registerService = async (serviceName, port) => {
  await consulClient.agent.service.register({
    name: serviceName,
    address: serviceName,
    port: parseInt(port),
    check: {
      http: `http://${serviceName}:${port}/health`,
      interval: '10s',
      timeout: '5s'
    }
  });
  logger.info(`Registered ${serviceName} with Consul`);
};

// Start server
app.listen(PORT, async () => {
  logger.info(`API Gateway running on port ${PORT}`);
  
  // Register with Consul
  try {
    await registerService('api-gateway', PORT);
  } catch (error) {
    logger.error('Failed to register with Consul:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  try {
    await consulClient.agent.service.deregister('api-gateway');
  } catch (error) {
    logger.error('Error deregistering from Consul:', error);
  }
  process.exit(0);
});

module.exports = app;