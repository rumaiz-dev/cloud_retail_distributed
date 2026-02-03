# CloudRetail Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the CloudRetail microservices application to AWS EKS.

## Files Overview

| File | Description |
|------|-------------|
| [`namespace.yaml`](namespace.yaml) | Creates the `cloudretail` namespace |
| [`configmap.yaml`](configmap.yaml) | Stores non-sensitive configuration (DB connection, service URLs, etc.) |
| [`secret.yaml`](secret.yaml) | Stores sensitive credentials (base64 encoded) |
| [`api-gateway-deployment.yaml`](api-gateway-deployment.yaml) | Deployment for API Gateway service (port 3000) |
| [`user-service-deployment.yaml`](user-service-deployment.yaml) | Deployment for User service (port 3001) |
| [`product-service-deployment.yaml`](product-service-deployment.yaml) | Deployment for Product service (port 3002) |
| [`order-service-deployment.yaml`](order-service-deployment.yaml) | Deployment for Order service (port 3003) |
| [`inventory-service-deployment.yaml`](inventory-service-deployment.yaml) | Deployment for Inventory service (port 3004) |
| [`service.yaml`](service.yaml) | ClusterIP services for internal communication |
| [`ingress.yaml`](ingress.yaml) | ALB Ingress for external access |
| [`hpa.yaml`](hpa.yaml) | Horizontal Pod Autoscalers for auto-scaling |
| [`kustomization.yaml`](kustomization.yaml) | Kustomize configuration for easy deployment |

## Prerequisites

1. **AWS CLI** - Installed and configured
2. **kubectl** - Installed and configured
3. **eksctl** - For creating EKS clusters
4. **helm** - For installing AWS Load Balancer Controller
5. **Docker images** - Pushed to Amazon ECR

## Quick Start

### 1. Configure AWS credentials

```bash
aws configure
```

### 2. Create EKS cluster (or use the provided script)

```bash
./eks-deploy.sh
```

Or manually:

```bash
# Create cluster
eksctl create cluster \
  --name cloudretail-cluster \
  --region ap-south-1 \
  --nodegroup-name cloudretail-node-group \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 10 \
  --managed

# Update kubeconfig
aws eks update-kubeconfig --name cloudretail-cluster --region ap-south-1
```

### 3. Install AWS Load Balancer Controller

```bash
# Add eks-charts repository
helm repo add eks https://aws.github.io/eks-charts

# Install the controller
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=cloudretail-cluster \
  --set serviceAccount.create=true \
  --set region=ap-south-1
```

### 4. Deploy the application

```bash
# Using kubectl
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f api-gateway-deployment.yaml
kubectl apply -f user-service-deployment.yaml
kubectl apply -f product-service-deployment.yaml
kubectl apply -f order-service-deployment.yaml
kubectl apply -f inventory-service-deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml

# Or using kustomize
kubectl apply -k .
```

### 5. Verify deployment

```bash
# Check namespace
kubectl get ns cloudretail

# Check deployments
kubectl get deployments -n cloudretail

# Check services
kubectl get svc -n cloudretail

# Check pods
kubectl get pods -n cloudretail

# Check ingress
kubectl get ingress -n cloudretail
```

## Configuration

### Update ECR image repository

Replace `<ECR_REPO>` in all deployment files with your actual ECR repository URL:

```bash
# Example for user-service
sed -i 's|<ECR_REPO>|123456789012.dkr.ecr.ap-south-1.amazonaws.com/user-service|g' user-service-deployment.yaml
```

### Update ACM certificate ARN

Replace `<ACM_CERTIFICATE_ARN>` in `ingress.yaml` with your AWS Certificate Manager ARN:

```yaml
annotations:
  alb.ingress.kubernetes.io/certificate-arn: "arn:aws:acm:ap-south-1:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## Resource Limits

Each service is configured with:
- **Requests:** 100m CPU, 128Mi memory
- **Limits:** 500m CPU, 512Mi memory

Adjust these values based on your actual resource requirements.

## Auto-Scaling

The HorizontalPodAutoscaler is configured to:
- **Min replicas:** 2
- **Max replicas:** 10
- **CPU target:** 70% utilization
- **Memory target:** 80% utilization

## Health Checks

All services include:
- **Liveness probe:** HTTP GET /health after 30s delay
- **Readiness probe:** HTTP GET /health after 10s delay
- **Startup probe:** For slow-starting containers

## Estimated AWS Costs

### EKS Cluster
- **EKS control plane:** $0.10/hour (Free tier: 750 hours/month)
- **EC2 instances (t3.medium):** ~$0.0416/hour per instance
- **EBS volumes:** ~$0.08/GB/month

### Load Balancer
- **ALB:** $0.025/hour + $0.008/GB processed

### Data Transfer
- **Inter-AZ transfer:** $0.01/GB

### Free Tier Eligibility
- **EKS:** 750 hours/month free for first 12 months
- **t3.medium:** 750 hours/month free for first 12 months (750 hours = 1 instance running 24/7)

### Monthly Cost Estimate (with free tier)
| Resource | Cost |
|----------|------|
| EKS Control Plane | $0.00 (free tier) |
| 3x t3.medium instances | ~$0.00 (free tier) |
| EBS volumes (30GB) | ~$2.40 |
| ALB | ~$18.00 |
| Data transfer | ~$5.00 |
| **Total** | **~$25.40/month** |

Without free tier: ~$75-100/month

## Cleanup

To delete all resources:

```bash
# Delete application
kubectl delete -k .

# Delete cluster
eksctl delete cluster --name cloudretail-cluster --region ap-south-1
```

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name> -n cloudretail
kubectl logs <pod-name> -n cloudretail
```

### Service not accessible
```bash
kubectl describe svc <service-name> -n cloudretail
```

### Ingress issues
```bash
kubectl describe ingress cloudretail-ingress -n cloudretail
```
