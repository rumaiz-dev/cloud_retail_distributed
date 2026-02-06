const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { errorHandler, notFoundHandler } = require('../middlewares/error.middleware');
const logger = require('../utils/logger');

const router = express.Router();


router.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});


router.get('/health', dashboardController.healthCheck.bind(dashboardController));


router.get('/summary', dashboardController.getSummary.bind(dashboardController));
router.get('/metrics', dashboardController.getMetrics.bind(dashboardController));
router.get('/inventory', dashboardController.getInventoryStats.bind(dashboardController));
router.get('/products', dashboardController.getProductStats.bind(dashboardController));
router.get('/orders', dashboardController.getOrderStats.bind(dashboardController));


router.post('/cache/invalidate', dashboardController.invalidateCache.bind(dashboardController));


router.use(notFoundHandler);


router.use(errorHandler);

module.exports = router;
