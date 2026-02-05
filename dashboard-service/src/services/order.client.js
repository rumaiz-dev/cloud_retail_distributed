const HttpClient = require('../clients/http-client');
const logger = require('../utils/logger');

class OrderClient {
  constructor() {
    const baseUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';
    this.httpClient = new HttpClient(baseUrl, 'order-service');
    this.baseUrl = baseUrl;
  }

  async getAllOrders(options = {}) {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/orders/all`, { params: options });
      return data;
    } catch (error) {
      logger.error('Failed to fetch orders:', error.message);
      return { count: 0, orders: [], pendingCount: 0, completedCount: 0, cancelledCount: 0 };
    }
  }

  async getTodayOrders() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/orders`, { 
        params: { dateFrom: today, dateTo: today } 
      });
      return data;
    } catch (error) {
      logger.error('Failed to fetch today orders:', error.message);
      return { count: 0, orders: [], revenue: 0 };
    }
  }

  async getRevenueMetrics(options = {}) {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/orders/stats/revenue`, { params: options });
      return data;
    } catch (error) {
      logger.error('Failed to fetch revenue metrics:', error.message);
      return { total: 0, average: 0 };
    }
  }

  async getRecentOrders(limit = 10) {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/orders/recent`, { params: { limit } });
      return data;
    } catch (error) {
      logger.error('Failed to fetch recent orders:', error.message);
      return { orders: [] };
    }
  }

  async getOrderStatusDistribution() {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/orders/stats/by-status`);
      return data;
    } catch (error) {
      logger.error('Failed to fetch order status distribution:', error.message);
      return { distribution: [] };
    }
  }

  async getOrderMetrics() {
    try {
      const [orders, todayOrders, revenue, recentOrders, statusDistribution] = await Promise.all([
        this.getAllOrders({ limit: 1 }),
        this.getTodayOrders(),
        this.getRevenueMetrics(),
        this.getRecentOrders(10),
        this.getOrderStatusDistribution()
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
        recentOrders: recentOrders.orders || [],
        statusDistribution: statusDistribution.distribution || []
      };
    } catch (error) {
      logger.error('Failed to fetch order metrics:', error.message);
      return {
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        todayOrders: 0,
        todayRevenue: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        recentOrders: [],
        statusDistribution: []
      };
    }
  }

  async checkHealth() {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/health`);
      return { status: 'healthy', service: 'order-service', details: data };
    } catch (error) {
      return { status: 'unhealthy', service: 'order-service', error: error.message };
    }
  }
}

module.exports = new OrderClient();
