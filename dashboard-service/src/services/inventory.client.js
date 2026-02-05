const HttpClient = require('../clients/http-client');
const logger = require('../utils/logger');

class InventoryClient {
  constructor() {
    const baseUrl = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3004';
    this.httpClient = new HttpClient(baseUrl, 'inventory-service');
    this.baseUrl = baseUrl;
  }

  async getStockSummary() {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/inventory/stats/summary`);
      return data;
    } catch (error) {
      logger.error('Failed to fetch inventory stock summary:', error.message);
      return { totalQuantity: 0, byWarehouse: [] };
    }
  }

  async getLowStockItems(options = {}) {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/inventory/stats/low-stock`, { params: options });
      return data;
    } catch (error) {
      logger.error('Failed to fetch low stock items:', error.message);
      return { count: 0, items: [] };
    }
  }

  async getOutOfStockItems() {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/inventory/stats/out-of-stock`);
      return data;
    } catch (error) {
      logger.error('Failed to fetch out of stock items:', error.message);
      return { count: 0, items: [] };
    }
  }

  async getStockByWarehouse() {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/inventory/stats/by-warehouse`);
      return data;
    } catch (error) {
      logger.error('Failed to fetch stock by warehouse:', error.message);
      return [];
    }
  }

  async getInventoryStats(options = {}) {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/api/v1/inventory/stats`, { params: options });
      return data;
    } catch (error) {
      logger.error('Failed to fetch inventory stats:', error.message);
      return null;
    }
  }

  async checkHealth() {
    try {
      const data = await this.httpClient.get(`${this.baseUrl}/health`);
      return { status: 'healthy', service: 'inventory-service', details: data };
    } catch (error) {
      return { status: 'unhealthy', service: 'inventory-service', error: error.message };
    }
  }
}

module.exports = new InventoryClient();
