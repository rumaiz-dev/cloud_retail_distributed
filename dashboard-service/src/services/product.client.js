const HttpClient = require('../clients/http-client');
const logger = require('../utils/logger');

class ProductClient {
  constructor() {
    const baseUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
    this.httpClient = new HttpClient(baseUrl, 'product-service');
    this.baseUrl = baseUrl;
  }

  async getAllProducts(options = {}) {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/products`, { params: options });
      return data;
    } catch (error) {
      logger.error('Failed to fetch products:', error.message);
      return { count: 0, products: [], activeCount: 0, inactiveCount: 0 };
    }
  }

  async getProductStats() {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/products/stats`);
      return data;
    } catch (error) {
      logger.error('Failed to fetch product stats:', error.message);
      return { totalProducts: 0, activeCount: 0, inactiveCount: 0 };
    }
  }

  async getCategories() {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/products/categories`);
      return data;
    } catch (error) {
      logger.error('Failed to fetch categories:', error.message);
      return { categories: [], distribution: [] };
    }
  }

  async getTopProducts(limit = 10) {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/products/top`, { params: { limit } });
      return data;
    } catch (error) {
      logger.error('Failed to fetch top products:', error.message);
      return { products: [] };
    }
  }

  async getProductMetrics() {
    try {
      const [products, categories] = await Promise.all([
        this.getProductStats(),
        this.getCategories()
      ]);

      return {
        totalProducts: products.totalProducts || 0,
        activeProducts: products.activeCount || 0,
        inactiveProducts: products.inactiveCount || 0,
        categoryCount: categories.categories?.length || 0,
        categoryDistribution: categories.distribution || []
      };
    } catch (error) {
      logger.error('Failed to fetch product metrics:', error.message);
      return {
        totalProducts: 0,
        activeProducts: 0,
        inactiveProducts: 0,
        categoryCount: 0,
        categoryDistribution: []
      };
    }
  }

  async checkHealth() {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/health`);
      return { status: 'healthy', service: 'product-service', details: data };
    } catch (error) {
      return { status: 'unhealthy', service: 'product-service', error: error.message };
    }
  }
}

module.exports = new ProductClient();
