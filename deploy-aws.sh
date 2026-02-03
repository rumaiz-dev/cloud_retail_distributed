#!/bin/bash

# =============================================================================
# AWS Deployment Script for Cloud Retail Services
# =============================================================================
# This script deploys the Cloud Retail microservices to AWS using Docker Compose.
# It uses AWS RDS for PostgreSQL and assumes services are running within AWS VPC.
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cloud Retail AWS Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if required environment variables are set
if [ -z "$DB_HOST" ]; then
    echo -e "${YELLOW}DB_HOST not set. Using default RDS endpoint...${NC}"
    export DB_HOST=cloud-retail.czyg604m8g8n.ap-south-1.rds.amazonaws.com
fi

if [ -z "$DB_NAME" ]; then
    echo -e "${YELLOW}DB_NAME not set. Using default...${NC}"
    export DB_NAME=cloudretail
fi

if [ -z "$DB_USER" ]; then
    echo -e "${YELLOW}DB_USER not set. Using default...${NC}"
    export DB_USER=postgres
fi

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${YELLOW}DB_PASSWORD not set. Using default...${NC}"
    export DB_PASSWORD=postgres
fi

if [ -z "$DB_PORT" ]; then
    echo -e "${YELLOW}DB_PORT not set. Using default...${NC}"
    export DB_PORT=5432
fi

# RabbitMQ configuration
if [ -z "$RABBITMQ_URL" ]; then
    echo -e "${YELLOW}RABBITMQ_URL not set. Using default...${NC}"
    export RABBITMQ_URL=amqp://rabbitmq:5672
fi

if [ -z "$RABBITMQ_USER" ]; then
    export RABBITMQ_USER=admin
fi

if [ -z "$RABBITMQ_PASSWORD" ]; then
    export RABBITMQ_PASSWORD=admin123
fi

# Redis configuration (optional - can be ElastiCache endpoint)
if [ -z "$REDIS_HOST" ]; then
    echo -e "${YELLOW}REDIS_HOST not set. Setting to empty for local Redis...${NC}"
    export REDIS_HOST=
fi

if [ -z "$REDIS_PORT" ]; then
    export REDIS_PORT=6379
fi

# JWT Secret (should be set in production)
if [ -z "$JWT_SECRET" ]; then
    echo -e "${YELLOW}WARNING: JWT_SECRET not set! Using default for development only!${NC}"
    export JWT_SECRET=your-secret-key-change-in-production
fi

echo ""
echo -e "${GREEN}Configuration:${NC}"
echo "  DB_HOST: $DB_HOST"
echo "  DB_NAME: $DB_NAME"
echo "  DB_USER: $DB_USER"
echo "  DB_PORT: $DB_PORT"
echo "  RABBITMQ_URL: $RABBITMQ_URL"
echo "  REDIS_HOST: ${REDIS_HOST:-not set}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping services...${NC}"
    docker compose -f docker-compose.aws.yml down
    echo -e "${GREEN}Services stopped.${NC}"
}

# Register cleanup function
trap cleanup EXIT

# Build and start services
echo -e "${GREEN}Building services...${NC}"
docker compose -f docker-compose.aws.yml build

echo ""
echo -e "${GREEN}Starting services...${NC}"
docker compose -f docker-compose.aws.yml up -d

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Services started:"
echo "  - API Gateway: http://localhost:3000"
echo "  - User Service: http://localhost:3001"
echo "  - Product Service: http://localhost:3002"
echo "  - Order Service: http://localhost:3003"
echo "  - Inventory Service: http://localhost:3004"
echo "  - Consul: http://localhost:8500"
echo "  - Prometheus: http://localhost:9090"
echo "  - Jaeger: http://localhost:16686"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop services.${NC}"

# Keep script running
wait
