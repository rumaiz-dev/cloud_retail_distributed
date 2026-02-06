# CloudRetail Integration Testing Framework

This document provides comprehensive documentation for the CloudRetail microservices integration testing framework. It covers the testing strategy, infrastructure, running tests locally, CI/CD pipeline, best practices, and troubleshooting guides.

## Table of Contents

1. [Introduction](#1-introduction)
2. [Test Infrastructure](#2-test-infrastructure)
3. [Running Tests Locally](#3-running-tests-locally)
4. [Test Structure](#4-test-structure)
5. [Jest Configuration](#5-jest-configuration)
6. [CI/CD Pipeline](#6-cicd-pipeline)
7. [Best Practices](#7-best-practices)
8. [Troubleshooting](#8-troubleshooting)
9. [Adding New Tests](#9-adding-new-tests)
10. [Coverage Reports](#10-coverage-reports)

---

## 1. Introduction

### Overview of the Testing Strategy

The CloudRetail project employs a comprehensive multi-layered testing strategy designed to ensure reliability, maintainability, and quality across all microservices. The testing framework is built on the following principles:

- **Test Isolation**: Each test runs independently without affecting others
- **Reproducibility**: Tests produce consistent results regardless of execution order
- **Speed**: Unit tests run in milliseconds; integration tests complete in seconds
- **Coverage**: Minimum 50% code coverage for all services
- **Maintainability**: Shared utilities reduce duplication and ensure consistency

### Testing Pyramid

The CloudRetail testing strategy follows the industry-standard testing pyramid:

```
                    ┌─────────────┐
                    │    E2E      │  ← 5% (Critical path tests)
                   ┌┴─────────────┴┐
                   │  Integration  │  ← 25% (Service interactions)
                  ┌┴───────────────┴┐
                  │      Unit       │  ← 70% (Individual functions)
                 └──────────────────┘
```

- **Unit Tests (70%)**: Test individual functions and methods in isolation
- **Integration Tests (25%)**: Test service interactions, database operations, and API endpoints
- **End-to-End Tests (5%)**: Test critical user journeys across multiple services

### Goals and Objectives

The primary objectives of the CloudRetail testing framework are:

1. **Reliability**: Catch bugs early in the development cycle
2. **Confidence**: Enable safe refactoring and feature development
3. **Documentation**: Tests serve as executable specifications
4. **Performance**: Identify performance regressions early
5. **Security**: Validate authentication and authorization flows

---

## 2. Test Infrastructure

### Overview of Test Utilities and Fixtures

CloudRetail provides a comprehensive set of shared test utilities and fixtures located in the [`shared/`](shared/) directory. These utilities are designed to:

- Reduce test code duplication across services
- Provide consistent test data and fixtures
- Simplify database and external service mocking
- Ensure test isolation and reproducibility

### Shared Test Utilities (`shared/test-utils/`)

#### [`database.js`](shared/test-utils/database.js)

Provides database connection management for integration tests with PostgreSQL using Sequelize.

**Key Functions:**

| Function | Description |
|----------|-------------|
| [`getTestDatabaseConfig()`](shared/test-utils/database.js:9) | Returns test database configuration object |
| [`createTestSequelize(config)`](shared/test-utils/database.js:26) | Creates a new Sequelize instance for testing |
| [`connectToTestDatabase()`](shared/test-utils/database.js:43) | Connects to the test database |
| [`closeTestDatabase(sequelize)`](shared/test-utils/database.js:56) | Closes the database connection |
| [`syncTestDatabase(sequelize, options)`](shared/test-utils/database.js:64) | Synchronizes database models |
| [`clearTestDatabase(sequelize)`](shared/test-utils/database.js:70) | Clears all tables (truncate) |
| [`createTestTransaction(sequelize)`](shared/test-utils/database.js:79) | Creates a transaction for tests |

**Usage Example:**

```javascript
const { connectToTestDatabase, syncTestDatabase, closeTestDatabase } = require('shared/test-utils/database');

describe('Product Service', () => {
  let sequelize;

  beforeAll(async () => {
    sequelize = await connectToTestDatabase();
    await syncTestDatabase(sequelize, { force: true });
  });

  afterAll(async () => {
    await closeTestDatabase(sequelize);
  });
});
```

#### [`fixtures.js`](shared/test-utils/fixtures.js)

Provides JWT token generation and authentication helpers for testing.

**Key Functions:**

| Function | Description |
|----------|-------------|
| [`generateTestToken(payload, options)`](shared/test-utils/fixtures.js:17) | Generates a valid JWT token |
| [`generateExpiredTestToken(payload)`](shared/test-utils/fixtures.js:35) | Generates an expired token |
| [`generateInvalidToken()`](shared/test-utils/fixtures.js:50) | Generates an invalid JWT token |
| [`verifyTestToken(token, options)`](shared/test-utils/fixtures.js:55) | Verifies a JWT token |
| [`generateTestTokens()`](shared/test-utils/fixtures.js:71) | Generates tokens for all roles (admin, customer, vendor) |

**Usage Example:**

```javascript
const { generateTestToken, generateTestTokens, generateExpiredTestToken } = require('shared/test-utils/fixtures');

// Generate a custom token
const adminToken = generateTestToken({
  userId: 'admin-123',
  email: 'admin@example.com',
  role: 'admin'
});

// Generate tokens for all roles
const tokens = generateTestTokens();
// tokens.admin, tokens.customer, tokens.vendor

// Use in request header
const response = await request(app)
  .get('/api/products')
  .set('Authorization', `Bearer ${adminToken}`);
```

#### [`mocks.js`](shared/test-utils/mocks.js)

Provides mock implementations for Redis and other external services.

**Key Classes and Functions:**

| Class/Function | Description |
|----------------|-------------|
| [`MockRedisClient`](shared/test-utils/mocks.js:9) | In-memory Redis mock with full API |
| [`createMockRedisClient()`](shared/test-utils/mocks.js:145) | Creates a new mock Redis client |
| [`mockRedisConnection()`](shared/test-utils/mocks.js:150) | Returns a mock Redis connection factory |

**MockRedisClient Supported Methods:**

```javascript
// Basic operations
await mockRedis.get(key);
await mockRedis.set(key, value, 'EX', 3600);
await mockRedis.del(key);
await mockRedis.keys(pattern);

// Hash operations
await mockRedis.hset(key, field, value);
await mockRedis.hget(key, field);
await mockRedis.hgetall(key);

// List operations
await mockRedis.lpush(key, ...values);
await mockRedis.lrange(key, 0, -1);

// Pub/Sub
await mockRedis.publish(channel, message);

// Utility
await mockRedis.flushall();
await mockRedis.ping();
```

**Usage Example:**

```javascript
const { createMockRedisClient } = require('shared/test-utils/mocks');

describe('Cache Service', () => {
  let redisClient;

  beforeEach(() => {
    redisClient = createMockRedisClient();
  });

  test('should store and retrieve cached data', async () => {
    await redisClient.set('user:123', JSON.stringify({ name: 'John' }));
    const data = await redisClient.get('user:123');
    expect(JSON.parse(data)).toEqual({ name: 'John' });
  });
});
```

#### [`rabbitmq.js`](shared/test-utils/rabbitmq.js)

Provides RabbitMQ mocking and testing utilities for message queue operations.

**Key Functions:**

| Function | Description |
|----------|-------------|
| [`createMockChannel()`](shared/test-utils/rabbitmq.js:1) | Creates a mock AMQP channel |
| [`mockPublishMessage(channel, exchange, routingKey, message)`](shared/test-utils/rabbitmq.js:1) | Mocks message publishing |
| [`mockConsumeMessages(channel, queue)`](shared/test-utils/rabbitmq.js:1) | Mocks message consumption |

#### [`cleanup.js`](shared/test-utils/cleanup.js)

Provides utilities for cleaning up test resources and ensuring test isolation.

**Key Functions:**

| Function | Description |
|----------|-------------|
| [`cleanupTestData(sequelize)`](shared/test-utils/cleanup.js:1) | Removes all test data |
| [`resetSequences(sequelize)`](shared/test-utils/cleanup.js:1) | Resets auto-increment sequences |
| [`teardownTestEnvironment()`](shared/test-utils/cleanup.js:1) | Full cleanup of test environment |

#### [`index.js`](shared/test-utils/index.js)

The main export file that combines all test utilities:

```javascript
module.exports = {
  ...database,
  ...fixtures,
  ...mocks,
  ...rabbitmq,
  ...cleanup,
};
```

### Shared Test Fixtures (`shared/test-fixtures/`)

#### [`sample-data.js`](shared/test-fixtures/sample-data.js)

Provides comprehensive sample data for all CloudRetail entities.

**Sample Users:**

```javascript
const { sampleUsers } = require('shared/test-fixtures/sample-data');

// sampleUsers.admin - Admin user with full permissions
// sampleUsers.customer - Regular customer user
// sampleUsers.vendor - Vendor user with limited permissions
```

**Sample Products:**

```javascript
const { sampleProducts } = require('shared/test-fixtures/sample-data');

// 4 sample products across categories:
// - test-product-001: Electronics
// - test-product-002: Clothing
// - test-product-003: Food
// - test-product-004: Home
```

**Sample Inventory:**

```javascript
const { sampleInventory } = require('shared/test-fixtures/sample-data');

// 3 inventory records with:
// - Quantity tracking
// - Reserved quantities
// - Reorder levels
// - Warehouse locations
```

**Sample Orders:**

```javascript
const { sampleOrders, sampleOrderItems } = require('shared/test-fixtures/sample-data');

// 3 orders in different states:
// - pending
// - confirmed
// - shipped

// 2 order items linked to test-order-001
```

**Helper Functions:**

| Function | Description |
|----------|-------------|
| [`createUserData(overrides)`](shared/test-fixtures/sample-data.js:188) | Creates user data with optional overrides |
| [`createProductData(overrides)`](shared/test-fixtures/sample-data.js:193) | Creates product data with optional overrides |
| [`createInventoryData(overrides)`](shared/test-fixtures/sample-data.js:198) | Creates inventory data with optional overrides |
| [`createOrderData(overrides)`](shared/test-fixtures/sample-data.js:203) | Creates order data with optional overrides |
| [`createOrderItemData(overrides)`](shared/test-fixtures/sample-data.js:208) | Creates order item data with optional overrides |

**Usage Example:**

```javascript
const { sampleUsers, sampleProducts, createOrderData } = require('shared/test-fixtures/sample-data');

describe('Order Service', () => {
  test('should create order with valid data', () => {
    const orderData = createOrderData({
      customerId: sampleUsers.customer.id,
      totalAmount: 299.99
    });
    
    // Use orderData in your test
  });
});
```

---

## 3. Running Tests Locally

### Prerequisites

Before running tests locally, ensure you have:

- **Node.js**: Version 18 or higher
- **Docker**: Latest stable version
- **Docker Compose**: Latest stable version

### Starting Test Infrastructure

Start the test infrastructure using Docker Compose:

```bash
# Start all test services (PostgreSQL, Redis, RabbitMQ)
docker-compose -f docker-compose.test.yml up -d
```

### Service Ports

| Service | Port | Health Check |
|---------|------|--------------|
| PostgreSQL | 5432 | `pg_isready -U postgres` |
| Redis | 6379 | `redis-cli ping` |
| RabbitMQ | 5672 | `rabbitmq-diagnostics check_port_connectivity` |

### Environment Configuration

Create a `.env.test` file in your service directory:

```bash
# User Service
NODE_ENV=test
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cloudretail_test
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
JWT_SECRET=test-secret-key-for-testing
JWT_EXPIRES_IN=1h
BCRYPT_ROUNDS=10
```

### Running Tests

#### All Tests in a Service

```bash
cd user-service && npm test
```

#### All Services Tests

```bash
# Run all tests from root
npm run test:all

# Or run per service
for service in user-service product-service order-service inventory-service api-gateway dashboard-service; do
  cd $service && npm test && cd ..
done
```

#### Integration Tests Only

```bash
cd user-service && npm run test:integration
```

#### Tests with Coverage

```bash
cd user-service && npm run test:coverage
```

#### Single Test File

```bash
cd user-service && npx jest src/tests/auth.test.js
```

#### Watch Mode

```bash
cd user-service && npm test -- --watch
```

### Stopping Test Infrastructure

```bash
docker-compose -f docker-compose.test.yml down

# Remove volumes (clears all test data)
docker-compose -f docker-compose.test.yml down -v
```

---

## 4. Test Structure

### Per-Service Test Directory Structure

Each microservice follows this test directory structure:

```
service-name/
├── src/
│   └── tests/
│       ├── setup.js           # Test setup configuration
│       ├── *.test.js          # Individual test files
│       └── integration/       # Integration tests
├── jest.config.js             # Jest configuration
└── package.json               # Test scripts
```

### Test Setup File (`setup.js`)

Each service has a setup file that configures the test environment:

```javascript
/**
 * Jest Test Setup for Service
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Service-specific utilities
};

// Clean up after all tests
afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});
```

### User Service Tests (`user-service/src/tests/`)

#### [`auth.test.js`](user-service/src/tests/auth.test.js)

Tests authentication flows including registration, login, and JWT validation.

```javascript
describe('Auth Controller', () => {
  describe('POST /api/auth/register', () => {
    test('should register a new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const { sampleUsers } = require('shared/test-fixtures/sample-data');
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: sampleUsers.customer.email,
          password: sampleUsers.customer.password
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });
  });
});
```

#### [`user.test.js`](user-service/src/tests/user.test.js)

Tests user profile CRUD operations.

```javascript
describe('User Controller', () => {
  let adminToken;
  let customerToken;

  beforeAll(() => {
    const { generateTestTokens } = require('shared/test-utils/fixtures');
    const tokens = generateTestTokens();
    adminToken = tokens.admin;
    customerToken = tokens.customer;
  });

  describe('GET /api/users/profile', () => {
    test('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${customerToken}`);
      
      expect(response.status).toBe(200);
    });
  });
});
```

### Product Service Tests (`product-service/src/tests/`)

#### [`product.test.js`](product-service/src/tests/product.test.js)

Tests product CRUD operations.

```javascript
describe('Product Service', () => {
  let vendorToken;

  beforeAll(() => {
    const { generateTestToken } = require('shared/test-utils/fixtures');
    vendorToken = generateTestToken({ role: 'vendor' });
  });

  describe('POST /api/products', () => {
    test('should create a new product', async () => {
      const productData = {
        name: 'New Product',
        description: 'Product description',
        price: 99.99,
        category: 'electronics',
        sku: 'NEW-PROD-001'
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(productData);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(productData.name);
    });
  });

  describe('GET /api/products/:id', () => {
    test('should get product by ID', async () => {
      const response = await request(app)
        .get('/api/products/test-product-001');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test-product-001');
    });
  });
});
```

#### [`product-search.test.js`](product-service/src/tests/product-search.test.js)

Tests search and filtering functionality.

```javascript
describe('Product Search', () => {
  test('should search products by keyword', async () => {
    const response = await request(app)
      .get('/api/products/search?q=electronics');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('should filter products by category', async () => {
    const response = await request(app)
      .get('/api/products?category=clothing');

    expect(response.status).toBe(200);
    expect(response.body.every(p => p.category === 'clothing')).toBe(true);
  });
});
```

### Order Service Tests (`order-service/src/tests/`)

#### [`order.test.js`](order-service/src/tests/order.test.js)

Tests order creation and management.

```javascript
describe('Order Service', () => {
  let customerToken;

  beforeAll(() => {
    const { generateTestToken } = require('shared/test-utils/fixtures');
    customerToken = generateTestToken({ role: 'customer' });
  });

  describe('POST /api/orders', () => {
    test('should create a new order', async () => {
      const { sampleProducts, sampleInventory } = require('shared/test-fixtures/sample-data');

      const orderData = {
        items: [
          { productId: sampleProducts[0].id, quantity: 2 }
        ],
        shippingAddress: '123 Test Street'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });
  });

  describe('GET /api/orders/:id', () => {
    test('should get order by ID', async () => {
      const response = await request(app)
        .get('/api/orders/test-order-001')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test-order-001');
    });
  });
});
```

#### [`order-item.test.js`](order-service/src/tests/order-item.test.js)

Tests order item operations.

```javascript
describe('Order Item Operations', () => {
  test('should add item to order', async () => {
    const { sampleProducts } = require('shared/test-fixtures/sample-data');

    const itemData = {
      orderId: 'test-order-001',
      productId: sampleProducts[1].id,
      quantity: 3
    };

    const response = await request(app)
      .post('/api/orders/items')
      .send(itemData);

    expect(response.status).toBe(201);
  });
});
```

### Inventory Service Tests (`inventory-service/src/tests/`)

#### [`inventory.test.js`](inventory-service/src/tests/inventory.test.js)

Tests stock management operations.

```javascript
describe('Inventory Service', () => {
  let adminToken;

  beforeAll(() => {
    const { generateTestToken } = require('shared/test-utils/fixtures');
    adminToken = generateTestToken({ role: 'admin' });
  });

  describe('GET /api/inventory/:productId', () => {
    test('should get inventory for product', async () => {
      const response = await request(app)
        .get('/api/inventory/test-product-001')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.productId).toBe('test-product-001');
    });
  });

  describe('PUT /api/inventory/:productId', () => {
    test('should update inventory quantity', async () => {
      const response = await request(app)
        .put('/api/inventory/test-product-001')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 150 });

      expect(response.status).toBe(200);
      expect(response.body.quantity).toBe(150);
    });
  });
});
```

#### [`inventory-sync.test.js`](inventory-service/src/tests/inventory-sync.test.js)

Tests RabbitMQ event handling for inventory synchronization.

```javascript
describe('Inventory Sync', () => {
  test('should handle order.created event', async () => {
    const event = {
      event: 'order.created',
      data: {
        orderId: 'test-order-001',
        items: [{ productId: 'test-product-001', quantity: 2 }]
      }
    };

    // Simulate message consumption
    await inventoryService.handleOrderCreated(event);
    
    // Verify inventory was updated
    const inventory = await inventoryService.getInventory('test-product-001');
    expect(inventory.reservedQuantity).toBeGreaterThanOrEqual(2);
  });
});
```

### API Gateway Tests (`api-gateway/src/tests/`)

#### [`gateway.test.js`](api-gateway/src/tests/gateway.test.js)

Tests routing, middleware, and request handling.

```javascript
describe('API Gateway', () => {
  test('should route requests to user service', async () => {
    const response = await request(gatewayApp)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(200);
    expect(response.body.service).toBe('user-service');
  });

  test('should handle authentication middleware', async () => {
    const response = await request(gatewayApp)
      .get('/api/users/profile');

    expect(response.status).toBe(401);
  });
});
```

### Dashboard Service Tests (`dashboard-service/src/tests/`)

#### [`dashboard.test.js`](dashboard-service/src/tests/dashboard.test.js)

Tests data aggregation from multiple services.

```javascript
describe('Dashboard Service', () => {
  test('should aggregate order statistics', async () => {
    const response = await request(app)
      .get('/api/dashboard/stats')
      .query({ startDate: '2024-01-01', endDate: '2024-12-31' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('totalOrders');
    expect(response.body).toHaveProperty('totalRevenue');
  });
});
```

#### [`cache.test.js`](dashboard-service/src/tests/cache.test.js)

Tests caching behavior and cache invalidation.

```javascript
describe('Cache Behavior', () => {
  test('should cache dashboard data', async () => {
    const client = createMockRedisClient();

    // First request - cache miss
    await request(app).get('/api/dashboard/stats');
    expect(client.get).toHaveBeenCalled();

    // Second request - cache hit (within TTL)
    await request(app).get('/api/dashboard/stats');
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  test('should invalidate cache on data change', async () => {
    await request(app).post('/api/orders').send(orderData);
    
    // Cache should be invalidated
    expect(client.del).toHaveBeenCalledWith('dashboard:stats');
  });
});
```

---

## 5. Jest Configuration

### User Service Jest Configuration

Located at [`user-service/jest.config.js`](user-service/jest.config.js):

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/tests/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
```

### Configuration Options Explained

| Option | Description | Value |
|--------|-------------|-------|
| `testEnvironment` | Test runtime environment | `node` |
| `testMatch` | Pattern to match test files | `**/src/tests/**/*.test.js` |
| `collectCoverageFrom` | Files to include in coverage | All source files except server and tests |
| `coverageDirectory` | Output directory for coverage reports | `coverage` |
| `coverageReporters` | Coverage report formats | `text`, `lcov`, `html` |
| `coverageThreshold` | Minimum coverage requirements | 50% for all metrics |
| `setupFilesAfterEnv` | Setup files to run after test framework | `setup.js` |
| `testTimeout` | Default test timeout | 30000ms |
| `forceExit` | Force Jest to exit after tests | `true` |
| `clearMocks` | Clear mock calls between tests | `true` |
| `resetMocks` | Reset mocks between tests | `true` |
| `restoreMocks` | Restore mocks to original implementation | `true` |

### Service-Specific Configurations

Each service has its own jest.config.js with service-specific thresholds and patterns. The configuration is similar across services but may include service-specific setup files.

---

## 6. CI/CD Pipeline

### GitHub Actions Workflow

The CloudRetail CI/CD pipeline is defined in [`.github/workflows/integration-tests.yml`](.github/workflows/integration-tests.yml).

### Workflow Triggers

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
```

The workflow runs on:
- Push to main or develop branches
- Pull requests targeting main or develop

### Environment Variables

```yaml
env:
  NODE_ENV: test
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres
  POSTGRES_DB: cloudretail_test
  REDIS_HOST: localhost
  REDIS_PORT: 6380
  RABBITMQ_HOST: localhost
  RABBITMQ_PORT: 5673
```

### Pipeline Stages

#### 1. Setup Stage

The setup job:
- Checks out the repository
- Sets up Docker Buildx
- Creates environment files for all services
- Caches npm dependencies
- Starts test infrastructure (PostgreSQL, Redis, RabbitMQ)
- Waits for services to be healthy
- Uploads infrastructure status as artifact

#### 2. Test Jobs (Matrix Testing)

Each service runs tests on Node.js 18 and 20:

**User Service Tests:**
- Installs dependencies
- Creates .env file with test configuration
- Runs tests with coverage
- Uploads coverage and test results

**Product Service Tests:**
- Same structure as user service
- Tests product CRUD and search

**Order Service Tests:**
- Tests order creation and management
- Tests order items operations

**Inventory Service Tests:**
- Tests inventory management
- Tests RabbitMQ event handling

**API Gateway Tests:**
- Tests routing and middleware

**Dashboard Service Tests:**
- Tests data aggregation
- Tests caching behavior

#### 3. Coverage Reporting

Coverage reports are:
- Generated in `coverage/` directory
- Uploaded as artifacts
- Can be viewed in GitHub Actions

### Running the Pipeline Locally

```bash
# Install dependencies for all services
npm run install:all

# Run tests for a specific service
cd user-service && npm test

# Run all tests
npm run test:ci
```

---

## 7. Best Practices

### Writing Effective Tests

#### Follow the AAA Pattern

```javascript
describe('User Service', () => {
  test('should register a new user', async () => {
    // Arrange
    const userData = { email: 'test@example.com', password: 'Password123!' };
    
    // Act
    const response = await request(app)
      .post('/api/auth/register')
      .send(userData);
    
    // Assert
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token');
  });
});
```

#### Use Descriptive Test Names

```javascript
// Good
test('should return 401 when no token is provided', async () => { });
test('should create order with valid items and reduce inventory', async () => { });

// Bad
test('test1', async () => { });
test('create order', async () => { });
```

### Test Isolation

#### Use Fresh Database for Integration Tests

```javascript
describe('Order Integration Tests', () => {
  let sequelize;

  beforeAll(async () => {
    sequelize = await connectToTestDatabase();
    await syncTestDatabase(sequelize, { force: true });
  });

  beforeEach(async () => {
    await clearTestDatabase(sequelize);
  });

  afterAll(async () => {
    await closeTestDatabase(sequelize);
  });
});
```

#### Reset Mocks Between Tests

```javascript
describe('Auth Controller', () => {
  let authService;

  beforeEach(() => {
    authService = jest.spyOn(AuthService.prototype, 'login');
    authService.mockResolvedValue({ token: 'test-token' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
```

### Mocking External Services

#### Mock Database

```javascript
jest.mock('../../config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    models: {
      User: {
        findOne: jest.fn(),
        create: jest.fn()
      }
    },
    close: jest.fn().mockResolvedValue(true)
  }
}));
```

#### Mock Redis

```javascript
const mockRedis = createMockRedisClient();

jest.mock('../../config/redis', () => ({
  createClient: jest.fn(() => mockRedis)
}));
```

### Handling Asynchronous Operations

#### Use Async/Await

```javascript
test('should wait for database sync before tests', async () => {
  await syncTestDatabase(sequelize);
  const user = await User.create(sampleUsers.customer);
  expect(user).toBeDefined();
});
```

#### Handle Promises Correctly

```javascript
test('should cleanup on test completion', async () => {
  // Ensure all async operations complete
  await expect(orderService.createOrder(data)).resolves.toBeDefined();
});
```

### Test Data Management

#### Use Shared Fixtures

```javascript
const { sampleUsers, sampleProducts, sampleInventory } = require('shared/test-fixtures/sample-data');

test('should create order with sample data', () => {
  const order = createOrderData({
    customerId: sampleUsers.customer.id,
    items: [
      { productId: sampleProducts[0].id, quantity: 1 }
    ]
  });
});
```

#### Create Test Data with Factories

```javascript
const createTestProduct = (overrides = {}) => ({
  name: 'Test Product',
  description: 'Description',
  price: 99.99,
  category: 'electronics',
  sku: `SKU-${Date.now()}`,
  ...overrides
});
```

### Coverage Guidelines

#### Minimum Thresholds

| Metric | Minimum | Target |
|--------|---------|--------|
| Statements | 50% | 80% |
| Branches | 50% | 80% |
| Functions | 50% | 80% |
| Lines | 50% | 80% |

#### Writing Tests for Coverage

```javascript
// Test all code paths
describe('calculateDiscount', () => {
  test('should return 0 for no discount', () => {
    expect(calculateDiscount(100, 0)).toBe(0);
  });

  test('should apply percentage discount', () => {
    expect(calculateDiscount(100, 10)).toBe(10);
  });

  test('should cap discount at maximum', () => {
    expect(calculateDiscount(1000, 50)).toBe(100);
  });
});
```

---

## 8. Troubleshooting

### Common Issues and Solutions

### Database Connection Problems

**Problem**: Unable to connect to PostgreSQL

**Solutions**:

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs cloudretail-test-postgres

# Verify connection
pg_isready -h localhost -p 5432 -U postgres
```

**Configuration Check**:

```javascript
const { getTestDatabaseConfig } = require('shared/test-utils/database');

console.log(getTestDatabaseConfig());
// Verify: host, port, username, password, database
```

### Docker Container Issues

**Problem**: Containers not starting

**Solutions**:

```bash
# Remove existing containers and volumes
docker-compose -f docker-compose.test.yml down -v

# Rebuild and start
docker-compose -f docker-compose.test.yml up -d

# Check container status
docker-compose -f docker-compose.test.yml ps
```

**Common Issues**:

1. **Port conflicts**: Ensure ports 5432, 6379, 5672 are not in use
2. **Memory limits**: Increase Docker memory to 4GB+
3. **Network issues**: Check Docker network connectivity

### Timeout Errors

**Problem**: Tests timing out

**Solutions**:

```javascript
// Increase timeout for slow tests
jest.setTimeout(60000);

// Or use per-test timeout
test('slow test', async () => {
  await new Promise(resolve => setTimeout(resolve, 50000));
}, 60000);
```

**Common Causes**:

- Database queries taking too long
- Network latency in integration tests
- External service timeouts

### Coverage Reporting Issues

**Problem**: Coverage not generated

**Solutions**:

```bash
# Run with coverage
npm run test:coverage

# Check jest configuration
npx jest --showConfig | grep coverage

# Ensure all files are included
collectCoverageFrom: ['src/**/*.js', '!src/tests/**']
```

### Mock Issues

**Problem**: Mocks not working

**Solutions**:

```javascript
// Ensure mocks are reset
beforeEach(() => {
  jest.clearAllMocks();
});

// Mock at the correct level
jest.mock('../../config/database', () => ({
  // Mock implementation
}));
```

---

## 9. Adding New Tests

### Step-by-Step Guide

#### 1. Create Test File

Create a new test file in `src/tests/` directory:

```javascript
// new-feature.test.js

describe('New Feature', () => {
  beforeAll(() => {
    // Setup
  });

  test('should do something', async () => {
    // Test
  });

  afterAll(() => {
    // Cleanup
  });
});
```

#### 2. Import Required Utilities

```javascript
const request = require('supertest');
const { generateTestToken } = require('shared/test-utils/fixtures');
const { sampleUsers } = require('shared/test-fixtures/sample-data');
```

#### 3. Configure Test Setup

Add to `src/tests/setup.js` if needed:

```javascript
process.env.NEW_FEATURE_FLAG = 'true';
```

#### 4. Write Tests

```javascript
describe('New Feature', () => {
  let app;
  let token;

  beforeAll(async () => {
    app = createApp(); // Your Express app
    token = generateTestToken({ role: 'admin' });
  });

  test('should handle new feature', async () => {
    const response = await request(app)
      .post('/api/new-feature')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: 'test' });

    expect(response.status).toBe(200);
  });
});
```

### Test File Template

```javascript
/**
 * [Feature Name] Tests
 * Tests for [brief description of what's being tested]
 */

const request = require('supertest');

// Import shared utilities
const { generateTestToken } = require('shared/test-utils/fixtures');
const { createTestData } = require('shared/test-fixtures/sample-data');

// Import mocks if needed
const { createMockRedisClient } = require('shared/test-utils/mocks');

describe('[Feature Name]', () => {
  let app;
  let token;
  let mockRedis;

  beforeAll(async () => {
    // Initialize app
    app = require('../../server');
    
    // Generate test token
    token = generateTestToken({
      userId: 'test-user-id',
      role: 'admin'
    });
    
    // Create mock services
    mockRedis = createMockRedisClient();
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('GET /api/endpoint', () => {
    test('should return expected response', async () => {
      const response = await request(app)
        .get('/api/endpoint')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('POST /api/endpoint', () => {
    test('should create new resource', async () => {
      const data = createTestData();

      const response = await request(app)
        .post('/api/endpoint')
        .set('Authorization', `Bearer ${token}`)
        .send(data);

      expect(response.status).toBe(201);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/endpoint')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });
});
```

### Using Shared Utilities

#### Database Operations

```javascript
const { connectToTestDatabase, syncTestDatabase } = require('shared/test-utils/database');

beforeAll(async () => {
  const sequelize = await connectToTestDatabase();
  await syncTestDatabase(sequelize, { force: true });
});
```

#### JWT Tokens

```javascript
const { generateTestToken, generateTestTokens } = require('shared/test-utils/fixtures');

// Custom token
const adminToken = generateTestToken({ role: 'admin', userId: 'admin-1' });

// Predefined role tokens
const { admin, customer, vendor } = generateTestTokens();
```

#### Test Fixtures

```javascript
const { sampleUsers, sampleProducts, createUserData } = require('shared/test-fixtures/sample-data');

// Use predefined data
const user = sampleUsers.admin;

// Or create with overrides
const customUser = createUserData({ email: 'custom@test.com' });
```

### Mock Configuration

#### Redis Mock

```javascript
const mockRedis = createMockRedisClient();

jest.mock('../../config/redis', () => ({
  createClient: jest.fn(() => mockRedis)
}));
```

#### HTTP Client Mock

```javascript
jest.mock('../../clients/http-client', () => ({
  get: jest.fn().mockResolvedValue({ data: 'mocked' }),
  post: jest.fn().mockResolvedValue({ success: true })
}));
```

---

## 10. Coverage Reports

### Understanding Coverage Metrics

| Metric | Description | Example |
|--------|-------------|---------|
| **Statements** | Executable statements in code | `if (x) { y = 1; }` - 2 statements |
| **Branches** | Decision points in code | `if/else` - 2 branches |
| **Functions** | Function declarations called | `function test() {}` |
| **Lines** | Lines of code executed | Any non-comment, non-blank line |

### Minimum Thresholds

All CloudRetail services enforce minimum coverage thresholds:

```javascript
coverageThreshold: {
  global: {
    branches: 50,
    functions: 50,
    lines: 50,
    statements: 50
  }
}
```

### Generating Reports

#### Terminal Output

```bash
npm test
```

#### HTML Report

```bash
npm run test:coverage
# Open coverage/lcov-report/index.html
```

#### CI/CD Report

Coverage reports are automatically:
1. Generated in `coverage/` directory
2. Uploaded as GitHub Actions artifacts
3. Available for download after CI runs

### Interpreting Results

#### Coverage Summary

```
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   78.45 |    71.23 |   82.14 |   78.45 |
 src/controllers    |   92.31 |    85.71 |   100   |   92.31 |
 src/services       |   75.00 |    66.66 |   80.00 |   75.00 |
 src/repositories    |   68.42 |    60.00 |   71.42 |   68.42 |
```

#### Identifying Uncovered Code

Open `coverage/lcov-report/index.html` to:
- View coverage heat maps
- Click on files to see uncovered lines
- Identify untested code paths

#### Improving Coverage

```javascript
// Before (50% coverage)
if (user.isActive) {
  return user.save();
}

// After (100% coverage)
if (user.isActive) {
  return user.save();
} else {
  throw new Error('User is inactive');
}
```

### Coverage Best Practices

1. **Don't aim for 100%** - Focus on critical paths
2. **Test edge cases** - Null, undefined, empty values
3. **Test error handling** - 400, 500 status codes
4. **Test authentication** - Token validation, expired tokens
5. **Test authorization** - Role-based access control

---

## Additional Resources

### Related Documentation

- [API Documentation](API_DOCUMENTATION.md)
- [Dashboard Service Architecture](DASHBOARD_SERVICE_ARCHITECTURE.md)
- [AWS Deployment Guide](AWS_DEPLOYMENT.md)

### Quick Reference

| Command | Description |
|---------|-------------|
| `docker-compose -f docker-compose.test.yml up -d` | Start test infrastructure |
| `npm test` | Run all tests in a service |
| `npm run test:coverage` | Run tests with coverage |
| `docker-compose -f docker-compose.test.yml down` | Stop test infrastructure |

---

This documentation provides a comprehensive guide to the CloudRetail testing framework. For questions or updates, please refer to the GitHub repository or contact the development team.
