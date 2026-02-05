const dashboardService = require('../services/dashboard.service');
const logger = require('../utils/logger');

class DashboardController {
  constructor(dashboardService) {
    this.dashboardService = dashboardService;
  }

  /**
   * GET /dashboard/summary
   * Get comprehensive dashboard summary
   */
  async getSummary(req, res, next) {
    try {
      const { period = 'all', warehouseId } = req.query;

      logger.info('Fetching dashboard summary', { period, warehouseId });

      const summary = await this.dashboardService.getDashboardSummary({
        period,
        warehouseId,
        includeCharts: true
      });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        data: summary
      });
    } catch (error) {
      logger.error('Error fetching dashboard summary:', error.message);
      next(error);
    }
  }

  /**
   * GET /dashboard/metrics
   * Get aggregated metrics
   */
  async getMetrics(req, res, next) {
    try {
      const { type = 'all', dateFrom, dateTo } = req.query;

      logger.info('Fetching dashboard metrics', { type, dateFrom, dateTo });

      const metrics = await this.dashboardService.getMetrics(type, {
        dateFrom,
        dateTo
      });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        data: metrics
      });
    } catch (error) {
      logger.error('Error fetching dashboard metrics:', error.message);
      next(error);
    }
  }

  /**
   * GET /dashboard/inventory
   * Get inventory statistics
   */
  async getInventoryStats(req, res, next) {
    try {
      const { warehouseId } = req.query;

      logger.info('Fetching inventory stats', { warehouseId });

      const stats = await this.dashboardService.getInventoryStats({ warehouseId });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching inventory stats:', error.message);
      next(error);
    }
  }

  /**
   * GET /dashboard/products
   * Get product statistics
   */
  async getProductStats(req, res, next) {
    try {
      const { category } = req.query;

      logger.info('Fetching product stats', { category });

      const stats = await this.dashboardService.getProductStats({ category });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching product stats:', error.message);
      next(error);
    }
  }

  /**
   * GET /dashboard/orders
   * Get order statistics
   */
  async getOrderStats(req, res, next) {
    try {
      const { dateFrom, dateTo, status } = req.query;

      logger.info('Fetching order stats', { dateFrom, dateTo, status });

      const stats = await this.dashboardService.getOrderStats({
        dateFrom,
        dateTo,
        status
      });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching order stats:', error.message);
      next(error);
    }
  }

  /**
   * GET /dashboard/health
   * Service health check
   */
  async healthCheck(req, res) {
    try {
      const serviceHealth = await this.dashboardService.checkServiceHealth();
      
      const allHealthy = Object.values(serviceHealth).every(s => s.status === 'healthy');
      
      const statusCode = allHealthy ? 200 : 503;
      
      res.status(statusCode).json({
        status: allHealthy ? 'healthy' : 'degraded',
        service: 'dashboard-service',
        timestamp: new Date().toISOString(),
        dependencies: serviceHealth
      });
    } catch (error) {
      logger.error('Error during health check:', error.message);
      res.status(503).json({
        status: 'unhealthy',
        service: 'dashboard-service',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }

  /**
   * POST /dashboard/cache/invalidate
   * Invalidate dashboard cache
   */
  async invalidateCache(req, res, next) {
    try {
      logger.info('Invalidating dashboard cache');
      
      await this.dashboardService.invalidateCache();

      res.json({
        success: true,
        message: 'Dashboard cache invalidated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error invalidating cache:', error.message);
      next(error);
    }
  }
}

module.exports = new DashboardController(dashboardService);
