#!/bin/bash

# EKS Deployment Script for CloudRetail
# This script creates an EKS cluster and deploys the CloudRetail application

set -e

# Configuration
CLUSTER_NAME="cloudretail-cluster"
REGION="ap-south-1"
NODE_GROUP_NAME="cloudretail-node-group"
NODE_INSTANCE_TYPE="t3.medium"
MIN_NODES=2
MAX_NODES=10
DESIRED_NODES=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_step() {
    echo -e "\n${GREEN}==> ${NC}${1}"
}

echo_warn() {
    echo -e "${YELLOW}WARNING: ${NC}${1}"
}

echo_error() {
    echo -e "${RED}ERROR: ${NC}${1}"
}

# Check prerequisites
check_prerequisites() {
    echo_step "Checking prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo_error "AWS CLI is not installed. Please install it first."
        echo "Visit: https://aws.amazon.com/cli/"
        exit 1
    fi

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        echo_error "kubectl is not installed. Please install it first."
        echo "Visit: https://kubernetes.io/docs/tasks/tools/"
        exit 1
    fi

    # Check eksctl
    if ! command -v eksctl &> /dev/null; then
        echo_warn "eksctl is not installed. Installing via Homebrew..."
        if command -v brew &> /dev/null; then
            brew install eksctl
        else
            echo_error "Homebrew is not installed. Please install eksctl manually."
            echo "Visit: https://eksctl.io/introduction/#installation"
            exit 1
        fi
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo_error "AWS credentials not configured. Please configure AWS CLI first."
        echo "Run: aws configure"
        exit 1
    fi

    echo "Prerequisites check passed!"
}

# Create EKS cluster
create_cluster() {
    echo_step "Creating EKS cluster: ${CLUSTER_NAME} in ${REGION}..."

    # Check if cluster already exists
    if eksctl get cluster --name ${CLUSTER_NAME} --region ${REGION} &> /dev/null; then
        echo_warn "Cluster ${CLUSTER_NAME} already exists. Skipping cluster creation."
        return 0
    fi

    # Create cluster with node group
    eksctl create cluster \
        --name ${CLUSTER_NAME} \
        --region ${REGION} \
        --nodegroup-name ${NODE_GROUP_NAME} \
        --node-type ${NODE_INSTANCE_TYPE} \
        --nodes ${DESIRED_NODES} \
        --nodes-min ${MIN_NODES} \
        --nodes-max ${MAX_NODES} \
        --managed \
        --asg-access \
        --external-dns-access \
        --full-ecr-access \
        --appmesh-access \
        --alb-ingress-access

    echo "Cluster created successfully!"
}

# Update kubeconfig
update_kubeconfig() {
    echo_step "Updating kubeconfig..."

    aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${REGION}

    echo "Kubeconfig updated!"
}

# Create AWS Load Balancer Controller
setup_alb_controller() {
    echo_step "Setting up AWS Load Balancer Controller..."

    # Check if ALB controller already exists
    if kubectl get deployment -n kube-system aws-load-balancer-controller &> /dev/null; then
        echo_warn "AWS Load Balancer Controller already installed. Skipping."
        return 0
    fi

    # Add eks-charts repository
    helm repo add eks https://aws.github.io/eks-charts || true

    # Update helm repositories
    helm repo update

    # Install AWS Load Balancer Controller
    helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
        -n kube-system \
        --set clusterName=${CLUSTER_NAME} \
        --set serviceAccount.create=true \
        --set region=${REGION} \
        --set vpcId=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${REGION} --query cluster.resourcesVpcConfig.vpcId --output text)

    echo "AWS Load Balancer Controller installed!"
}

# Create Fargate profile (optional - for serverless pods)
setup_fargate() {
    echo_step "Setting up Fargate profile..."

    # Check if Fargate profile already exists
    if eksctl get fargateprofile --cluster ${CLUSTER_NAME} --region ${REGION} &> /dev/null; then
        echo_warn "Fargate profile already exists. Skipping."
        return 0
    fi

    # Create Fargate profile
    eksctl create fargateprofile \
        --cluster ${CLUSTER_NAME} \
        --region ${REGION} \
        --name cloudretail-fargate-profile \
        --namespace cloudretail \
        --labels app=cloudretail

    echo "Fargate profile created!"
}

# Deploy CloudRetail application
deploy_application() {
    echo_step "Deploying CloudRetail application..."

    # Apply Kubernetes manifests
    kubectl apply -k k8s/

    echo "Kubernetes manifests applied!"

    # Wait for deployments to be ready
    echo_step "Waiting for deployments to be ready..."

    # Wait for all deployments
    for service in api-gateway user-service product-service order-service inventory-service; do
        echo "Waiting for ${service}..."
        kubectl rollout status deployment/${service} -n cloudretail --timeout=300s || echo_warn "Timeout waiting for ${service}"
    done

    echo "All deployments are ready!"
}

# Verify deployment
verify_deployment() {
    echo_step "Verifying deployment..."

    echo "\n=== Namespace Status ==="
    kubectl get ns cloudretail

    echo "\n=== Deployments ==="
    kubectl get deployments -n cloudretail

    echo "\n=== Services ==="
    kubectl get svc -n cloudretail

    echo "\n=== Pods ==="
    kubectl get pods -n cloudretail

    echo "\n=== Ingress ==="
    kubectl get ingress -n cloudretail

    echo "\n=== Horizontal Pod Autoscalers ==="
    kubectl get hpa -n cloudretail
}

# Get ingress URL
get_ingress_url() {
    echo_step "Getting ingress URL..."

    # Wait for ingress to be provisioned
    echo "Waiting for ingress to be provisioned..."
    sleep 30

    INGRESS_HOST=$(kubectl get ingress cloudretail-ingress -n cloudretail -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    if [ -z "$INGRESS_HOST" ]; then
        INGRESS_HOST=$(kubectl get ingress cloudretail-ingress -n cloudretail -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    fi

    if [ -n "$INGRESS_HOST" ]; then
        echo "Application URL: http://${INGRESS_HOST}"
    else
        echo_warn "Ingress hostname not available yet. Check AWS Console for status."
    fi
}

# Main function
main() {
    echo -e "${GREEN}=====================================${NC}"
    echo -e "${GREEN}  CloudRetail EKS Deployment Script${NC}"
    echo -e "${GREEN}=====================================${NC}"

    echo_step "Starting deployment in region: ${REGION}"

    # Run deployment steps
    check_prerequisites
    create_cluster
    update_kubeconfig
    setup_alb_controller
    setup_fargate
    deploy_application
    verify_deployment
    get_ingress_url

    echo_step "Deployment completed successfully!"
    echo "\nTo access the application:"
    echo "  1. Get the ingress URL: kubectl get ingress -n cloudretail"
    echo "  2. Check pod status: kubectl get pods -n cloudretail"
    echo "  3. View logs: kubectl logs -f <pod-name> -n cloudretail"
}

# Run main function
main "$@"
