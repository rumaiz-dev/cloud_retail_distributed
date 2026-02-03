# AWS Deployment Guide

This guide explains how to deploy the Cloud Retail services to AWS using Docker Compose with AWS RDS.

## Prerequisites

1. **AWS Account** with access to:
   - RDS (PostgreSQL)
   - ElastiCache (Redis) - optional
   - EC2 Instance or ECS for running Docker
   - Security groups configured to allow traffic between services

2. **Docker & Docker Compose** installed on the AWS instance

3. **Network Access**: Ensure the AWS instance can connect to:
   - RDS endpoint (port 5432)
   - ElastiCache endpoint (port 6379) - if using
   - Internet for pulling Docker images

## Configuration

### 1. Update Environment Variables

Set the following environment variables before running the deployment:

```bash
export DB_HOST=cloud-retail.czyg604m8g8n.ap-south-1.rds.amazonaws.com
export DB_NAME=cloudretail
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_PORT=5432

# Optional: ElastiCache Redis
export REDIS_HOST=your-elasticache-endpoint.cache.amazonaws.com
export REDIS_PORT=6379

# RabbitMQ (using local container or AWS MQ)
export RABBITMQ_URL=amqp://rabbitmq:5672
export RABBITMQ_USER=admin
export RABBITMQ_PASSWORD=admin123

# JWT Secret (use a strong value in production)
export JWT_SECRET=your-secure-jwt-secret
```

### 2. Security Group Configuration

Ensure your AWS security group allows:
- Inbound: Port 3000-3004 (API Gateway and services)
- Inbound: Port 8500 (Consul)
- Inbound: Port 9090 (Prometheus)
- Inbound: Port 16686 (Jaeger)
- Outbound: RDS port 5432
- Outbound: ElastiCache port 6379 (if using)

## Deployment Steps

### Option 1: Using the Deployment Script

1. Make the script executable:
```bash
chmod +x deploy-aws.sh
```

2. Run the deployment script:
```bash
./deploy-aws.sh
```

### Option 2: Manual Deployment

1. Set environment variables:
```bash
export DB_HOST=cloud-retail.czyg604m8g8n.ap-south-1.rds.amazonaws.com
export DB_NAME=cloudretail
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_PORT=5432
export JWT_SECRET=your-secure-jwt-secret
export RABBITMQ_URL=amqp://rabbitmq:5672
```

2. Build and start services:
```bash
docker compose -f docker-compose.aws.yml build
docker compose -f docker-compose.aws.yml up -d
```

## Services Exposed

After deployment, the following services will be available:

| Service | Port | Endpoint |
|---------|------|----------|
| API Gateway | 3000 | http://localhost:3000 |
| User Service | 3001 | http://localhost:3001 |
| Product Service | 3002 | http://localhost:3002 |
| Order Service | 3003 | http://localhost:3003 |
| Inventory Service | 3004 | http://localhost:3004 |
| Consul | 8500 | http://localhost:8500 |
| Prometheus | 9090 | http://localhost:9090 |
| Jaeger | 16686 | http://localhost:16686 |

## Verifying Deployment

1. Check service health:
```bash
docker compose -f docker-compose.aws.yml ps
```

2. View logs:
```bash
docker compose -f docker-compose.aws.yml logs -f
```

3. Test API Gateway:
```bash
curl http://localhost:3000/health
```

## Stopping Services

```bash
docker compose -f docker-compose.aws.yml down
```

## Production Considerations

1. **Use AWS Secrets Manager**: Store sensitive values like DB_PASSWORD and JWT_SECRET in AWS Secrets Manager and configure the application to retrieve them at runtime.

2. **Use AWS ECR**: Push Docker images to Amazon Elastic Container Registry for production deployments.

3. **Use ECS/EKS**: For production, consider using Amazon ECS or EKS instead of Docker Compose.

4. **Enable CloudWatch Logging**: Configure CloudWatch logging for production by using the `awslogs` driver.

5. **Set Up Load Balancing**: Use an Application Load Balancer in front of the API Gateway.

6. **Enable Auto Scaling**: Configure auto-scaling for the services based on CPU/memory usage.

## Troubleshooting

### Cannot Connect to RDS
- Verify security group allows inbound from the Docker host
- Check that the RDS instance is in the same VPC or properly configured for cross-VPC access
- Test connectivity: `telnet cloud-retail.czyg604m8g8n.ap-south-1.rds.amazonaws.com 5432`

### Services Not Starting
- Check logs: `docker compose -f docker-compose.aws.yml logs <service-name>`
- Verify all environment variables are set
- Ensure sufficient memory/disk space on the Docker host

### Consul Registration Issues
- Ensure consul is running: `docker ps | grep consul`
- Check consul logs: `docker compose -f docker-compose.aws.yml logs consul`
