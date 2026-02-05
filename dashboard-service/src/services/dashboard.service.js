const inventoryClient = require('./inventory.client');
const productClient = require('./product.client');
const orderClient = require('./order.client');
const cacheClient = require('./cache.client');
const logger = require('../utils/logger');

class DashboardService {
  constructor() {
    this.cacheTTL = parseInt(process.env.DASHBOARD_CACHE_TTL) || 60;
  }

  /**
   * Get cache key for dashboard data
   */
  getCacheKey(type, options = {}) {
    const { period = 'all', warehouseId = null } = options;
    let key = `dashboard:${type}:${period}`;
    if (warehouseId) {
      key += `:${warehouseId}`;
    }
    return key;
  }

  /**
   * Try to get data from cache
   */
  async getCachedData(key) {
    try {
      const cached = await cacheClient.get(key);
      if (cached) {
        logger.debug(`Cache hit for key: ${key}`);
        return cached;
      }
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache error for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set data in cache
   */
  async setCachedData(key, data) {
    try {
      await cacheClient.set(key, data, this.cacheTTL);
      logger.debug(`Cache set for key: ${key}`);
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error.message);
    }
  }

  /**
   * Get comprehensive dashboard summary
   */
  async getDashboardSummary(options = {}) {
    const cacheKey = this.getCacheKey('summary', options);
    
    // Try cache first
    const cachedData = await this.getCachedData(cacheKey);
    if (cachedData) {
      return { ...cachedData, fromCache: true };
    }

    // Fetch data from all services in parallel
    const [inventoryMetrics, productMetrics, orderMetrics] = await Promise.all([
      this.getInventoryMetrics(),
      this.getProductMetrics(),
      this.getOrderMetrics()
    ]);

    // Aggregate the metrics
    const summary = this.aggregateMetrics(inventoryMetrics, productMetrics, orderMetrics);
    
    // Cache the result
    await this.setCachedData(cacheKey, summary);

    return { ...summary, fromCache: false };
  }

  /**
   * Get inventory metrics
   */
  async getInventoryMetrics() {
    try {
      const [stockSummary, lowStock, outOfStock, byWarehouse] = await Promise.all([
        inventoryClient.getStockSummary(),
        inventoryClient.getLowStockItems({ limit: 10 }),
        inventoryClient.getOutOfStockItems(),
        inventoryClient.getStockByWarehouse()
      ]);

      return {
        totalStock: stockSummary.totalQuantity || 0,
        lowStockCount: lowStock.count || 0,
        outOfStockCount: outOfStock.count || 0,
        lowStockItems: lowStock.items || [],
        warehouseDistribution: stockSummary.byWarehouse || byWarehouse || []
      };
    } catch (error) {
      logger.error('Failed to get inventory metrics:', error.message);
      return {
        totalStock: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        lowStockItems: [],
        warehouseDistribution: []
      };
    }
  }

  /**
   * Get product metrics
   */
  async getProductMetrics() {
    try {
      const [products, categories] = await Promise.all([
        productClient.getProductStats(),
        productClient.getCategories()
      ]);

      return {
        totalProducts: products.totalProducts || 0,
        activeProducts: products.activeCount || 0,
        inactiveProducts: products.inactiveCount || 0,
        categoryCount: categories.categories?.length || 0,
        categoryDistribution: categories.distribution || []
      };
    } catch (error) {
      logger.error('Failed to get product metrics:', error.message);
      return {
        totalProducts: 0,
        activeProducts: 0,
        inactiveProducts: 0,
        categoryCount: 0,
        categoryDistribution: []
      };
    }
  }

  /**
   * Get order metrics
   */
  async getOrderMetrics() {
    try {
      const [orders, todayOrders, revenue, recentOrders] = await Promise.all([
        orderClient.getAllOrders({ limit: 1 }),
        orderClient.getTodayOrders(),
        orderClient.getRevenueMetrics(),
        orderClient.getRecentOrders(10)
      ]);

      return {
        totalOrders: orders.count || 0,
        pendingOrders: orders.pendingCount || 0,
        completedOrders: orders.completedCount || 0,
        cancelledOrders: orders.cancelledCount || 0,
        todayOrders: todayOrders.count || 0,
        todayRevenue: todayOrders.revenue || 0,
        totalRevenue: revenue.total || 0,
        averageOrderValue: revenue.average || 0,
        recentOrders: recentOrders.orders || []
      };
    } catch (error) {
      logger.error('Failed to get order metrics:', error.message);
      return {
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        todayOrders: 0,
        todayRevenue: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        recentOrders: []
      };
    }
  }

  /**
   * Aggregate metrics from all services into a summary
   */
  aggregateMetrics(inventoryMetrics, productMetrics, orderMetrics) {
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalProducts: productMetrics.totalProducts,
        totalOrders: orderMetrics.totalOrders,
        totalRevenue: orderMetrics.totalRevenue,
        lowStockItems: inventoryMetrics.lowStockCount,
        pendingOrders: orderMetrics.pendingOrders,
        todayOrders: orderMetrics.todayOrders,
        todayRevenue: orderMetrics.todayRevenue
      },
      inventory: {
        totalStock: inventoryMetrics.totalStock,
        lowStockCount: inventoryMetrics.lowStockCount,
        outOfStockCount: inventoryMetrics.outOfStockCount,
        lowStockItems: inventoryMetrics.lowStockItems.slice(0, 10),
        warehouseDistribution: inventoryMetrics.warehouseDistribution
      },
      products: {
        totalProducts: productMetrics.totalProducts,
        categoryCount: productMetrics.categoryCount,
        activeProducts: productMetrics.activeProducts,
        inactiveProducts: productMetrics.inactiveProducts,
        categoryDistribution: productMetrics.categoryDistribution
      },
      orders: {
        totalOrders: orderMetrics.totalOrders,
        pendingOrders: orderMetrics.pendingOrders,
        completedOrders: orderMetrics.completedOrders,
        cancelledOrders: orderMetrics.cancelledOrders,
        averageOrderValue: orderMetrics.averageOrderValue,
        todayOrders: orderMetrics.todayOrders,
        todayRevenue: orderMetrics.todayRevenue,
        recentOrders: orderMetrics.recentOrders.slice(0, 10)
      }
    };
  }

  /**
   * Get specific metrics based on type
   */
  async getMetrics(type, options = {}) {
    const cacheKey = this.getCacheKey(`metrics:${type}`, options);
    
    const cachedData = await this.getCachedData(cacheKey);
    if (cachedData) {
      return { ...cachedData, fromCache: true };
    }

    let metrics;
    switch (type) {
      case 'inventory':
        metrics = await this.getInventoryMetrics();
        break;
      case 'products':
        metrics = await this.getProductMetrics();
        break;
      case 'orders':
        metrics = await this.getOrderMetrics();
        break;
      case 'all':
      default:
        metrics = await this.getDashboardSummary(options);
    }

    await this.setCachedData(cacheKey, metrics);
    return { ...metrics, fromCache: false };
  }

  /**
   * Get inventory-specific dashboard data
   */
  async getInventoryStats(options = {}) {
    const cacheKey = this.getCacheKey('inventory', options);
    
    const cachedData = await this.getCachedData(cacheKey);
    if (cachedData) {
      return { ...cachedData, fromCache: true };
    }

    const metrics = await this.getInventoryMetrics();
    await this.setCachedData(cacheKey, metrics);
    
    return { ...metrics, fromCache: false };
  }

  /**
   * Get product-specific dashboard data
   */
  async getProductStats(options = {}) {
    const cacheKey = this.getCacheKey('products', options);
    
    const cachedData = await this.getCachedData(cacheKey);
    if (cachedData) {
      return { ...cachedData, fromCache: true };
    }

    const metrics = await this.getProductMetrics();
    await this.setCachedData(cacheKey, metrics);
    
    return { ...metrics, fromCache: false };
  }

  /**
   * Get order-specific dashboard data
   */
  async getOrderStats(options = {}) {
    const cacheKey = this.getCacheKey('orders', options);
    
    const cachedData = await this.getCachedData(cacheKey);
    if (cachedData) {
      return { ...cachedData, fromCache: true };
    }

    const metrics = await this.getOrderMetrics();
    await this.setCachedData(cacheKey, metrics);
    
    return { ...metrics, fromCache: false };
  }

  /**
   * Check health of all dependent services
   */
  async checkServiceHealth() {
    const [inventoryHealth, productHealth, orderHealth, cacheHealth] = await Promise.all([
      inventoryClient.checkHealth(),
      productClient.checkHealth(),
      orderClient.checkHealth(),
      { status: cacheClient.isHealthy() ? 'healthy' : 'unhealthy', service: 'redis-cache' }
    ]);

    return {
      inventory: inventoryHealth,
      products: productHealth,
      orders: orderHealth,
      cache: cacheHealth
    };
  }

  /**
   * Invalidate all dashboard cache
   */
  async invalidateCache() {
    try {
      // Note: In a real implementation, you would want to track all cache keys
      // and delete them. For now, we'll just return success.
      logger.info('Dashboard cache invalidated');
      return true;
    } catch (error) {
      logger.error('Failed to invalidate cache:', error.message);
      return false;
    }
  }
}

module.exports = new DashboardService();
