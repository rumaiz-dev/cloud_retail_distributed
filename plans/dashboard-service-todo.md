# Dashboard Service Implementation TODO List

## Phase 1: Core Infrastructure
- [ ] Create `dashboard-service/` directory structure
- [ ] Create `dashboard-service/package.json` with dependencies
- [ ] Create `dashboard-service/.env.example` configuration template
- [ ] Create `dashboard-service/Dockerfile`
- [ ] Create `dashboard-service/src/config/database.js` (Redis configuration)
- [ ] Create `dashboard-service/src/utils/logger.js` (Winston logger)
- [ ] Create `dashboard-service/src/middlewares/error.middleware.js`

## Phase 2: Service Clients
- [ ] Create `dashboard-service/src/clients/http-client.js` (Axios-based HTTP client with retry)
- [ ] Create `dashboard-service/src/clients/service-endpoints.js` (Endpoint configurations)
- [ ] Create `dashboard-service/src/services/inventory.client.js` (Inventory service client)
- [ ] Create `dashboard-service/src/services/product.client.js` (Product service client)
- [ ] Create `dashboard-service/src/services/order.client.js` (Order service client)

## Phase 3: Dashboard Service Layer
- [ ] Create `dashboard-service/src/services/dashboard.service.js` (Main aggregation logic)
  - Implement `getDashboardSummary()` method
  - Implement `getInventoryMetrics()` method
  - Implement `getProductMetrics()` method
  - Implement `getOrderMetrics()` method
  - Implement `aggregateMetrics()` helper method
  - Implement `checkServiceHealth()` method

## Phase 4: Controller and Routes
- [ ] Create `dashboard-service/src/controllers/dashboard.controller.js`
  - Implement `getSummary()` handler
  - Implement `getMetrics()` handler
  - Implement `getInventoryStats()` handler
  - Implement `getProductStats()` handler
  - Implement `getOrderStats()` handler
  - Implement `healthCheck()` handler
- [ ] Create `dashboard-service/src/routes/dashboard.routes.js`
- [ ] Create `dashboard-service/src/server.js` (Main entry point)

## Phase 5: API Gateway Integration
- [ ] Add dashboard service route to `api-gateway/src/server.js`
- [ ] Add environment variable for dashboard service URL
- [ ] Create Swagger documentation for dashboard endpoints

## Phase 6: Kubernetes Deployment
- [ ] Create `k8s/dashboard-service-deployment.yaml`
- [ ] Add dashboard service to `k8s/kustomization.yaml`
- [ ] Add dashboard service to `k8s/namespace.yaml` (if needed)

## Phase 7: Testing
- [ ] Create `dashboard-service/src/tests/dashboard.service.test.js`
- [ ] Create `dashboard-service/src/tests/dashboard.controller.test.js`
- [ ] Create `dashboard-service/src/tests/http-client.test.js`
- [ ] Run integration tests against existing services

## Priority Endpoints to Implement
1. `GET /api/v1/dashboard/summary` - Full dashboard aggregation
2. `GET /api/v1/dashboard/health` - Service health check
3. `GET /api/v1/dashboard/metrics` - Aggregated metrics
4. `GET /api/v1/dashboard/inventory` - Inventory statistics
5. `GET /api/v1/dashboard/products` - Product statistics
6. `GET /api/v1/dashboard/orders` - Order statistics

## Required Environment Variables
```
NODE_ENV=development
PORT=3005
SERVICE_API_KEY=your-service-api-key
INVENTORY_SERVICE_URL=http://api-gateway:3000/api/inventory
PRODUCT_SERVICE_URL=http://api-gateway:3000/api/products
ORDER_SERVICE_URL=http://api-gateway:3000/api/orders
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
DASHBOARD_CACHE_TTL=60
REQUEST_TIMEOUT=15000
LOG_LEVEL=info
LOG_FILE=logs/dashboard-service.log
```

## Key Implementation Notes
- Use `Promise.all()` for parallel service calls
- Implement Redis caching with configurable TTL
- Add circuit breaker pattern for service resilience
- Use Joi for request validation
- Follow existing service patterns for consistency
- Include proper error handling and logging
