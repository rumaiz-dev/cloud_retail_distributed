/**
 * Prometheus Metrics Utility
 * Shared metrics collection for all microservices
 */

const promClient = require('prom-client');

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default labels (service name)
register.setDefaultLabels({
  app: process.env.SERVICE_NAME || 'cloudretail-service'
});

// Collect default Node.js metrics (CPU, memory, event loop)
promClient.collectDefaultMetrics({ register });

// Custom Metrics

// HTTP Request Duration Histogram
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5]
});
register.registerMetric(httpRequestDuration);

// HTTP Requests Total Counter
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestsTotal);

// HTTP Requests In Flight (Gauge)
const httpRequestsInFlight = new promClient.Gauge({
  name: 'http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed'
});
register.registerMetric(httpRequestsInFlight);

// Database Operations Counter
const dbOperationsTotal = new promClient.Counter({
  name: 'db_operations_total',
  help: 'Total database operations',
  labelNames: ['operation', 'table', 'status']
});
register.registerMetric(dbOperationsTotal);

// Database Operation Duration Histogram
const dbOperationDuration = new promClient.Histogram({
  name: 'db_operation_duration_seconds',
  help: 'Duration of database operations in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});
register.registerMetric(dbOperationDuration);

// Message Queue Operations Counter
const mqOperationsTotal = new promClient.Counter({
  name: 'mq_operations_total',
  help: 'Total message queue operations',
  labelNames: ['operation', 'queue', 'status']
});
register.registerMetric(mqOperationsTotal);

// Cache Operations Counter
const cacheOperationsTotal = new promClient.Counter({
  name: 'cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['operation', 'key', 'status']
});
register.registerMetric(cacheOperationsTotal);

// Cache Hit Rate Gauge
const cacheHitRate = new promClient.Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type']
});
register.registerMetric(cacheHitRate);

// Business Metrics - Orders
const ordersTotal = new promClient.Counter({
  name: 'orders_total',
  help: 'Total number of orders',
  labelNames: ['status', 'payment_method']
});
register.registerMetric(ordersTotal);

// Business Metrics - Products
const productsTotal = new promClient.Counter({
  name: 'products_total',
  help: 'Total number of product operations',
  labelNames: ['operation', 'category']
});
register.registerMetric(productsTotal);

// Business Metrics - Users
const usersTotal = new promClient.Counter({
  name: 'users_total',
  help: 'Total number of user operations',
  labelNames: ['operation']
});
register.registerMetric(usersTotal);

// Business Metrics - Inventory
const inventoryTotal = new promClient.Counter({
  name: 'inventory_total',
  help: 'Total inventory operations',
  labelNames: ['operation', 'product_id']
});
register.registerMetric(inventoryTotal);

// Service Health Gauge
const serviceHealth = new promClient.Gauge({
  name: 'service_health',
  help: 'Health status of dependent services',
  labelNames: ['service_name']
});
register.registerMetric(serviceHealth);

// Error Counter
const errorsTotal = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route', 'status_code']
});
register.registerMetric(errorsTotal);

// Middleware to collect HTTP metrics
const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();
  
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path || 'unknown';
    const statusCode = res.statusCode.toString();
    const method = req.method;
    
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
  });
  
  httpRequestsInFlight.inc();
  res.on('finish', () => httpRequestsInFlight.dec());
  
  next();
};

// Helper functions for recording metrics
const recordDbOperation = (operation, table, status = 'success') => {
  dbOperationsTotal.inc({ operation, table, status });
  return operation;
};

const recordDbDuration = (operation, table, duration) => {
  dbOperationDuration.observe({ operation, table }, duration);
};

const recordMqOperation = (operation, queue, status = 'success') => {
  mqOperationsTotal.inc({ operation, queue, status });
};

const recordCacheOperation = (operation, key, status = 'success') => {
  cacheOperationsTotal.inc({ operation, key, status });
};

const recordOrder = (status, paymentMethod) => {
  ordersTotal.inc({ status, payment_method: paymentMethod || 'unknown' });
};

const recordProductOperation = (operation, category) => {
  productsTotal.inc({ operation, category: category || 'general' });
};

const recordUserOperation = (operation) => {
  usersTotal.inc({ operation });
};

const recordInventoryOperation = (operation, productId) => {
  inventoryTotal.inc({ operation, product_id: productId || 'unknown' });
};

const recordError = (type, route, statusCode) => {
  errorsTotal.inc({ type, route, status_code: statusCode.toString() });
};

const updateServiceHealth = (serviceName, isHealthy) => {
  serviceHealth.set({ service_name: serviceName }, isHealthy ? 1 : 0);
};

// Get all metrics in Prometheus format
const getMetrics = async () => {
  return register.metrics();
};

// Get metrics content type
const getContentType = () => {
  return register.contentType;
};

module.exports = {
  register,
  metricsMiddleware,
  recordDbOperation,
  recordDbDuration,
  recordMqOperation,
  recordCacheOperation,
  recordOrder,
  recordProductOperation,
  recordUserOperation,
  recordInventoryOperation,
  recordError,
  updateServiceHealth,
  getMetrics,
  getContentType,
  // Expose metrics for convenience
  httpRequestDuration,
  httpRequestsTotal,
  httpRequestsInFlight,
  dbOperationsTotal,
  dbOperationDuration,
  mqOperationsTotal,
  cacheOperationsTotal,
  cacheHitRate,
  ordersTotal,
  productsTotal,
  usersTotal,
  inventoryTotal,
  serviceHealth,
  errorsTotal
};
