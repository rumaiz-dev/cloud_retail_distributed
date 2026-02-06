/**
 * Jest Test Setup for Order Service
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.TEST_DB_NAME = 'cloudretail_test';
process.env.TEST_DB_USER = 'postgres';
process.env.TEST_DB_PASSWORD = 'postgres';
process.env.TEST_DB_HOST = 'localhost';
process.env.TEST_DB_PORT = '5433';

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
