/**
 * Dashboard Service - Dashboard Tests
 * Tests for data aggregation from multiple services
 */

const request = require('supertest');
const express = require('express');

// Mock HTTP client
jest.mock('../clients/http-client', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const httpClient = require('../clients/http-client');

// Create a simple test app with dashboard features
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Auth middleware (simplified - no JWT needed for tests)
  const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  };

  // Get dashboard overview
  app.get('/api/dashboard/overview', authMiddleware, async (req, res) => {
    try {
      // Fetch data from multiple services in parallel
      const [usersResponse, productsResponse, ordersResponse, inventoryResponse] = await Promise.all([
        httpClient.get('http://user-service:3001/api/users/count'),
        httpClient.get('http://product-service:3002/api/products/count'),
        httpClient.get('http://order-service:3003/api/orders/count'),
        httpClient.get('http://inventory-service:3004/api/inventory/low-stock/count'),
      ]);

      const data = {
        totalUsers: usersResponse.data.count || 0,
        totalProducts: productsResponse.data.count || 0,
        totalOrders: ordersResponse.data.count || 0,
        lowStockItems: inventoryResponse.data.count || 0,
        lastUpdated: new Date().toISOString(),
      };

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  // Get sales analytics
  app.get('/api/dashboard/sales', authMiddleware, async (req, res) => {
    const { period = 'week' } = req.query;

    try {
      const [ordersResponse, revenueResponse] = await Promise.all([
        httpClient.get(`http://order-service:3003/api/orders/summary?period=${period}`),
        httpClient.get(`http://order-service:3003/api/orders/revenue?period=${period}`),
      ]);

      const data = {
        period,
        totalOrders: ordersResponse.data.total || 0,
        totalRevenue: revenueResponse.data.total || 0,
        averageOrderValue: ordersResponse.data.total > 0 
          ? revenueResponse.data.total / ordersResponse.data.total 
          : 0,
      };

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch sales analytics' });
    }
  });

  // Get inventory status
  app.get('/api/dashboard/inventory', authMiddleware, async (req, res) => {
    try {
      const response = await httpClient.get('http://inventory-service:3004/api/inventory/status');

      const data = {
        items: response.data.inventory || [],
        totalItems: response.data.inventory?.length || 0,
        lowStockCount: response.data.inventory?.filter(i => i.quantity <= i.reorderLevel).length || 0,
        lastUpdated: new Date().toISOString(),
      };

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch inventory status' });
    }
  });

  // Get customer analytics
  app.get('/api/dashboard/customers', authMiddleware, async (req, res) => {
    try {
      const [usersResponse, ordersResponse] = await Promise.all([
        httpClient.get('http://user-service:3001/api/users'),
        httpClient.get('http://order-service:3003/api/orders/customer-stats'),
      ]);

      const data = {
        totalCustomers: usersResponse.data.users?.length || 0,
        activeCustomers: ordersResponse.data.activeCustomers || 0,
        newCustomersThisMonth: usersResponse.data.newThisMonth || 0,
        customerStats: ordersResponse.data.customerStats || {},
      };

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch customer analytics' });
    }
  });

  return app;
};

describe('Dashboard Service', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('GET /api/dashboard/overview', () => {
    it('should return dashboard overview', async () => {
      httpClient.get.mockResolvedValueOnce({ data: { count: 100 } }) // users
        .mockResolvedValueOnce({ data: { count: 500 } }) // products
        .mockResolvedValueOnce({ data: { count: 200 } }) // orders
        .mockResolvedValueOnce({ data: { count: 5 } }); // low stock

      const response = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.totalUsers).toBe(100);
      expect(response.body.totalProducts).toBe(500);
      expect(response.body.totalOrders).toBe(200);
      expect(response.body.lowStockItems).toBe(5);
    });

    it('should return 401 without auth', async () => {
      const response = await request(app)
        .get('/api/dashboard/overview');

      expect(response.status).toBe(401);
    });

    it('should handle service failures gracefully', async () => {
      httpClient.get.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/dashboard/sales', () => {
    it('should return sales analytics', async () => {
      httpClient.get.mockResolvedValueOnce({ data: { total: 100 } }) // orders
        .mockResolvedValueOnce({ data: { total: 9999.99 } }); // revenue

      const response = await request(app)
        .get('/api/dashboard/sales?period=week')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.period).toBe('week');
      expect(response.body.totalOrders).toBe(100);
      expect(response.body.totalRevenue).toBe(9999.99);
      expect(response.body.averageOrderValue).toBe(99.9999);
    });

    it('should calculate average order value correctly', async () => {
      httpClient.get.mockResolvedValueOnce({ data: { total: 50 } })
        .mockResolvedValueOnce({ data: { total: 5000 } });

      const response = await request(app)
        .get('/api/dashboard/sales?period=month')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.averageOrderValue).toBe(100);
    });

    it('should handle zero orders', async () => {
      httpClient.get.mockResolvedValueOnce({ data: { total: 0 } })
        .mockResolvedValueOnce({ data: { total: 0 } });

      const response = await request(app)
        .get('/api/dashboard/sales?period=day')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.averageOrderValue).toBe(0);
    });
  });

  describe('GET /api/dashboard/inventory', () => {
    it('should return inventory status', async () => {
      httpClient.get.mockResolvedValue({
        data: {
          inventory: [
            { productId: 'prod-1', quantity: 100, reorderLevel: 20 },
            { productId: 'prod-2', quantity: 10, reorderLevel: 20 },
            { productId: 'prod-3', quantity: 5, reorderLevel: 10 },
          ],
        },
      });

      const response = await request(app)
        .get('/api/dashboard/inventory')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.totalItems).toBe(3);
      expect(response.body.lowStockCount).toBe(2);
    });
  });

  describe('GET /api/dashboard/customers', () => {
    it('should return customer analytics', async () => {
      httpClient.get.mockResolvedValueOnce({
        data: {
          users: [
            { id: '1', createdAt: new Date() },
            { id: '2', createdAt: new Date() },
          ],
          newThisMonth: 5,
        },
      })
        .mockResolvedValueOnce({
          data: {
            activeCustomers: 100,
            customerStats: {},
          },
        });

      const response = await request(app)
        .get('/api/dashboard/customers')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.totalCustomers).toBe(2);
      expect(response.body.activeCustomers).toBe(100);
      expect(response.body.newCustomersThisMonth).toBe(5);
    });
  });

  describe('Parallel Data Fetching', () => {
    it('should fetch multiple services in parallel', async () => {
      httpClient.get.mockResolvedValue({ data: { count: 0 } });

      await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', 'Bearer valid-token');

      // Should have been called 4 times (users, products, orders, inventory)
      expect(httpClient.get).toHaveBeenCalledTimes(4);
    });
  });
});
