# CloudRetail Monitoring Setup

This document describes the monitoring stack for CloudRetail microservices.

## Architecture

The monitoring stack consists of:
- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Jaeger** - Distributed tracing

## Services Endpoints

Each service exposes metrics at `/metrics` endpoint:

| Service | Port | Metrics URL |
|---------|------|------------|
| API Gateway | 3000 | http://api-gateway:3000/metrics |
| User Service | 3001 | http://user-service:3001/metrics |
| Product Service | 3002 | http://product-service:3002/metrics |
| Order Service | 3003 | http://order-service:3003/metrics |
| Inventory Service | 3004 | http://inventory-service:3004/metrics |
| Dashboard Service | 3005 | http://dashboard-service:3005/metrics |

## Available Metrics

### HTTP Metrics
- `http_request_duration_seconds` - Request duration in seconds
- `http_requests_total` - Total number of HTTP requests
- `http_requests_in_flight` - Current requests being processed

### Database Metrics
- `db_operations_total` - Total database operations
- `db_operation_duration_seconds` - Database operation duration

### Message Queue Metrics
- `mq_operations_total` - Total message queue operations

### Cache Metrics
- `cache_operations_total` - Total cache operations
- `cache_hit_rate` - Cache hit rate percentage

### Business Metrics
- `orders_total` - Total orders by status
- `products_total` - Total product operations
- `users_total` - Total user operations
- `inventory_total` - Total inventory operations

### Error Metrics
- `errors_total` - Total errors by type

## Grafana Dashboards

Two dashboards are available:

### 1. Service Health Dashboard
Shows overall service health including:
- Service status (up/down)
- Error rates
- Response times
- Memory usage
- Request rates

**Dashboard UID:** `cloudretail-service-health`

### 2. API Metrics Dashboard
Shows API performance metrics including:
- HTTP requests by status code
- Response time percentiles (P50, P90, P99)
- Requests by HTTP method
- Error rates by route
- Requests in flight
- Overall success rate

**Dashboard UID:** `cloudretail-api-metrics`

## Access Points

- **Grafana:** http://localhost:3005
  - Default credentials: admin/admin
  
- **Prometheus:** http://localhost:9090
  - Query metrics directly using PromQL
  
- **Jaeger:** http://localhost:16686
  - View distributed traces

## Running the Monitoring Stack

```bash
# Start all services including monitoring
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f grafana
docker-compose logs -f prometheus
```

## Query Examples

### Check if all services are up
```promql
up
```

### Get error rate for a service
```promql
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])
```

### Get P95 response time
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Get requests per second
```promql
rate(http_requests_total[1m])
```

## Alerting

To set up alerts:

1. In Grafana, go to Alerting > Contact points
2. Configure notification channels (email, Slack, etc.)
3. Create alert rules based on metrics thresholds

Example alert rule:
- Condition: `avg() of query(A, 5m, now) > 0.05`
- For: `5m`
- Labels: `severity=critical`
- Annotations: `summary=High error rate detected`

## Prometheus Configuration

The Prometheus configuration is located at:
- `monitoring/prometheus.yml`

Grafana provisioning configurations:
- `monitoring/dashboards.yml` - Dashboard provider config
- `monitoring/datasources.yml` - Data source config
- `monitoring/grafana.ini` - Grafana settings

## Best Practices

1. **Metric Labels**: Use consistent labels across services
2. **Cardinality**: Avoid high-cardinality labels (e.g., user IDs)
3. **Retention**: Configure appropriate retention periods
4. **Alerts**: Set up alerts for critical metrics
5. **Dashboards**: Create service-specific dashboards as needed
