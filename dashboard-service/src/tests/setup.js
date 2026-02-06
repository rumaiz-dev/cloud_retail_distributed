/**
 * Jest Test Setup for Dashboard Service
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6380';
process.env.USER_SERVICE_URL = 'http://localhost:3001';
process.env.PRODUCT_SERVICE_URL = 'http://localhost:3002';
process.env.ORDER_SERVICE_URL = 'http://localhost:3003';
process.env.INVENTORY_SERVICE_URL = 'http://localhost:3004';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Will be populated with test utilities from shared
};

// Clean up after all tests
afterAll(async () => {
  // Allow time for connections to close
  await new Promise(resolve => setTimeout(resolve, 100));
});
