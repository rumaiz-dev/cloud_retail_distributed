const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { errorHandler, notFoundHandler } = require('../middlewares/error.middleware');
const logger = require('../utils/logger');

const router = express.Router();

// Request logging middleware
router.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check (public)
router.get('/health', dashboardController.healthCheck.bind(dashboardController));

// Dashboard routes
router.get('/summary', dashboardController.getSummary.bind(dashboardController));
router.get('/metrics', dashboardController.getMetrics.bind(dashboardController));
router.get('/inventory', dashboardController.getInventoryStats.bind(dashboardController));
router.get('/products', dashboardController.getProductStats.bind(dashboardController));
router.get('/orders', dashboardController.getOrderStats.bind(dashboardController));

// Cache management
router.post('/cache/invalidate', dashboardController.invalidateCache.bind(dashboardController));

// 404 handler for this router
router.use(notFoundHandler);

// Error handler for this router
router.use(errorHandler);

module.exports = router;
