# CloudRetail Microservices Project

A Node.js-based microservices architecture for a retail management system, containerized with Docker and orchestrated for scalability.

## 🚀 Project Overview

CloudRetail is a modern microservices application designed to handle retail operations including user management, product catalog, order processing, and inventory tracking. The architecture follows best practices for distributed systems with service discovery, centralized logging, metrics collection, and distributed tracing.

### Architecture Highlights

- **API Gateway Pattern**: Single entry point for all client requests with routing and load balancing
- **Service Discovery**: Dynamic service registration and discovery using Consul
- **Event-Driven Architecture**: Asynchronous communication via RabbitMQ message queues
- **Polyglot Persistence**: MongoDB for document storage, PostgreSQL for relational data, Redis for caching
- **Observability**: Prometheus for metrics, Grafana for dashboards, Jaeger for distributed tracing

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Docker Desktop** (v20.10+)
- **Docker Compose** (v2.0+)
- **Node.js** (v18+, for local development)
- **Git** (for version control)

### System Requirements

- At least 4GB of available RAM (8GB recommended)
- At least 10GB of disk space
- Windows 10/11, macOS, or Linux

## 🏃 Quick Start

### Option 1: Start All Services with Docker Compose

```bash
# Clone the repository
git clone <repository-url>
cd cloudretail

# Start all services
docker-compose up -d

# View running services
docker-compose ps
```

### Option 2: Start Services Individually

```bash
# Start infrastructure services first
docker-compose up -d consul mongodb postgres redis rabbitmq prometheus grafana jaeger

# Then start application services
docker-compose up -d api-gateway user-service product-service order-service inventory-service
```

### Verify Installation

Check that all containers are running:

```bash
docker-compose ps
```

Expected output should show all services with "Up" status.

## 📁 Project Structure

```
cloudretail/
├── api-gateway/                 # API Gateway service
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   ├── swagger.yaml            # API documentation
│   └── src/
│       └── server.js           # Gateway server entry point
│
├── user-service/               # User management service
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   └── src/
│       ├── server.js
│       └── tests/
│           └── user.test.js    # Unit tests
│
├── product-service/            # Product catalog service
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   └── src/
│       └── server.js
│
├── order-service/              # Order processing service
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   └── src/
│       └── server.js
│
├── inventory-service/          # Inventory management service
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   └── src/
│       └── server.js
│
├── shared/                      # Shared utilities and libraries
│   (shared code across services)
│
├── monitoring/                  # Monitoring configuration
│   └── prometheus.yml          # Prometheus scraping configuration
│
├── load-tests/                  # Load testing scripts
│   └── load-test.js
│
├── docker-compose.yml          # Docker Compose configuration
├── aws-docker-compose.yml      # AWS deployment configuration
├── .gitignore
└── README.md
```

## 🛠 Services Description

### API Gateway (Port 3000)

The API Gateway serves as the single entry point for all client requests. It handles:

- Request routing to appropriate microservices
- Authentication and authorization
- Rate limiting and request throttling
- API documentation via Swagger

**Endpoints**: All microservices are accessed through the gateway at `http://localhost:3000`

### User Service (Port 3001)

Handles all user-related operations:

- User registration and authentication
- Profile management
- Role-based access control
- User preferences and settings

**Endpoints** (via gateway):
- `POST /users` - Create new user
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Product Service (Port 3002)

Manages the product catalog:

- Product CRUD operations
- Category management
- Product search and filtering
- Inventory level queries

**Endpoints** (via gateway):
- `GET /products` - List all products
- `POST /products` - Create product
- `GET /products/:id` - Get product details
- `PUT /products/:id` - Update product
- `DELETE /products/:id` - Delete product

### Order Service (Port 3003)

Handles order processing workflows:

- Order creation and validation
- Order status tracking
- Payment processing integration
- Order history and reporting

**Endpoints** (via gateway):
- `POST /orders` - Create new order
- `GET /orders` - List orders
- `GET /orders/:id` - Get order details
- `PUT /orders/:id/status` - Update order status

### Inventory Service (Port 3004)

Manages inventory operations:

- Stock level tracking
- Inventory reservations
- Low stock alerts
- Warehouse management

**Endpoints** (via gateway):
- `GET /inventory` - List inventory
- `GET /inventory/:productId` - Get stock level
- `PUT /inventory/:productId` - Update stock
- `POST /inventory/reserve` - Reserve inventory

## 🏗 Infrastructure Services

| Service | Port | Description |
|---------|------|-------------|
| **Consul** | 8500 | Service discovery and configuration management |
| **MongoDB** | 27017 | Document database for flexible data storage |
| **PostgreSQL** | 5432 | Relational database for structured data |
| **Redis** | 6379 | In-memory cache for performance optimization |
| **RabbitMQ** | 5672, 15672 | Message broker for event-driven communication |
| **Prometheus** | 9090 | Metrics collection and storage |
| **Grafana** | 3005 | Visualization dashboards for metrics |
| **Jaeger** | 16686 | Distributed tracing and monitoring |

### Starting Infrastructure Only

```bash
docker-compose up -d consul mongodb postgres redis rabbitmq prometheus grafana jaeger
```

## 🔧 Development Commands

### Local Development

```bash
# Install dependencies for a specific service
cd <service-name>
npm install

# Run service in development mode
npm run dev

# Run tests
npm test
```

### Docker Commands

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build api-gateway

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f api-gateway

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart a specific service
docker-compose restart api-gateway
```

### Load Testing

```bash
# Run load tests
cd load-tests
node load-test.js
```

## 🌐 Accessing Services

| Service | URL | Description |
|---------|-----|-------------|
| API Gateway | http://localhost:3000 | Main API entry point |
| Consul UI | http://localhost:8500 | Service discovery console |
| RabbitMQ Management | http://localhost:15672 | Message queue admin (default: guest/guest) |
| Prometheus | http://localhost:9090 | Metrics dashboard |
| Grafana | http://localhost:3005 | Visualization dashboards (default: admin/admin) |
| Jaeger UI | http://localhost:16686 | Distributed tracing console |

### Health Check Endpoints

All services expose health check endpoints:

- `http://localhost:<service-port>/health`

## 📊 Monitoring Setup

### Prometheus Configuration

The monitoring configuration is located in `monitoring/prometheus.yml`. Prometheus automatically scrapes metrics from all services configured with `/metrics` endpoints.

### Grafana Dashboards

Access Grafana at http://localhost:3005 and configure:

1. Add Prometheus as a data source
2. Import pre-built dashboards for microservices monitoring
3. Create custom dashboards for service-specific metrics

### Jaeger Tracing

Access the Jaeger UI at http://localhost:16686 to:

- View service dependencies
- Trace requests across services
- Analyze performance bottlenecks
- Debug distributed transactions

## 🚀 Deployment

### AWS Deployment

For AWS deployment, use the alternative compose file:

```bash
docker-compose -f aws-docker-compose.yml up -d
```

### Custom Environment Variables

Create a `.env` file in the project root:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/cloudretail

# PostgreSQL
POSTGRES_URI=postgresql://user:password@localhost:5432/cloudretail

# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# Consul
CONSUL_HOST=localhost
CONSUL_PORT=8500
```

## 🧪 Testing

### Unit Tests

Run unit tests for all services:

```bash
# Run all tests
npm test

# Run tests for specific service
cd user-service && npm test
```

### Integration Tests

Integration tests require all infrastructure services to be running:

```bash
docker-compose up -d
npm run test:integration
```

## 📝 API Documentation

API documentation is available via Swagger UI:

- Access at: http://localhost:3000/api-docs
- Swagger specification: `api-gateway/swagger.yaml`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find the process using the port
netstat -ano | findstr :3000

# Kill the process (Windows)
taskkill /PID <PID> /F
```

**Docker container won't start:**
```bash
# Check logs
docker-compose logs <service-name>

# Check container status
docker-compose ps -a
```

**Cannot connect to database:**
```bash
# Verify database is running
docker-compose ps | grep mongodb

# Check database logs
docker-compose logs mongodb
```

### Reset Everything

To completely reset the environment:

```bash
docker-compose down -v
docker-compose up -d
```

---

**Built with ❤️ using Node.js, Docker, and modern microservices patterns**
