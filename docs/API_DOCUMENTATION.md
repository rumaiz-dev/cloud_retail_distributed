# CloudRetail API Documentation

## Overview

CloudRetail is a microservices-based e-commerce platform consisting of 6 services:

| Service | Port | Base Path | Description |
|---------|------|-----------|-------------|
| API Gateway | 3000 | `/` | Single entry point for all microservices |
| User Service | 3001 | `/api/v1/auth` | User authentication and management |
| Product Service | 3002 | `/api/v1/products` | Product catalog management |
| Order Service | 3003 | `/api/v1/orders` | Order processing and management |
| Inventory Service | 3004 | `/api/v1/inventory` | Stock and inventory management |
| Dashboard Service | 3005 | `/api/v1/dashboard` | Analytics and reporting |

---

## Authentication

Most endpoints require JWT authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

**Roles:**
- `customer` - Regular user
- `admin` - Administrator with full access
- `vendor` - Vendor/seller access

---

## API Gateway Endpoints

The API Gateway (port 3000) serves as the single entry point.

### Health Check

**GET** `/health`

Check the health status of all microservices.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "user": "healthy",
    "product": "healthy",
    "order": "healthy",
    "inventory": "healthy"
  }
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "degraded",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "user": "healthy",
    "product": "unhealthy",
    "order": "healthy",
    "inventory": "healthy"
  }
}
```

---

## User Service API

**Base URL:** `/api/v1/auth` (via gateway: `/api/auth`)

### Register User

**POST** `/api/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "customer"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | Valid email address |
| password | string | Yes | Minimum 6 characters |
| firstName | string | Yes | User's first name |
| lastName | string | Yes | User's last name |
| role | string | No | `customer`, `admin`, or `vendor` (default: `customer`) |

**Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid-xxxx-xxxx",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "customer",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### Login

**POST** `/api/auth/login`

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-xxxx-xxxx",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "customer"
  }
}
```

---

### Get Profile

**GET** `/api/users/profile`

Get current user's profile. **Requires authentication.**

**Response (200 OK):**
```json
{
  "id": "uuid-xxxx-xxxx",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "customer",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

### Update Profile

**PUT** `/api/users/profile`

Update current user's profile. **Requires authentication.**

**Request Body:**
```json
{
  "firstName": "Johnathan",
  "lastName": "Doe"
}
```

**Response (200 OK):**
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "uuid-xxxx-xxxx",
    "email": "user@example.com",
    "firstName": "Johnathan",
    "lastName": "Doe",
    "role": "customer"
  }
}
```

---

### Get All Users (Admin)

**GET** `/api/users`

Get all users. **Requires admin role.**

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Maximum records to return (default: all) |
| offset | number | Number of records to skip |

**Response (200 OK):**
```json
{
  "count": 2,
  "users": [
    {
      "id": "uuid-xxxx-xxxx",
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "admin"
    },
    {
      "id": "uuid-yyyy-yyyy",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "customer"
    }
  ]
}
```

---

### Get User By ID

**GET** `/api/users/:id`

Get user by ID. **Requires authentication** (admin or self).

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | User ID |

**Response (200 OK):**
```json
{
  "id": "uuid-xxxx-xxxx",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "customer",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Response (404 Not Found):**
```json
{
  "error": "User not found"
}
```

---

## Product Service API

**Base URL:** `/api/v1/products` (via gateway: `/api/products`)

### Get All Products

**GET** `/api/products`

Retrieve a paginated list of products.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter by category |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |
| sort | string | Sort field (default: createdAt) |
| includeInactive | boolean | Include inactive products |

**Response (200 OK):**
```json
{
  "count": 50,
  "page": 1,
  "limit": 20,
  "totalPages": 3,
  "products": [
    {
      "id": "uuid-xxxx-xxxx",
      "sku": "PROD-001",
      "name": "Product Name",
      "description": "Product description",
      "price": 29.99,
      "category": "Electronics",
      "stockQuantity": 100,
      "images": ["https://example.com/image1.jpg"],
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Get Product By ID

**GET** `/api/products/:id`

Get a single product by ID.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Product ID |

**Response (200 OK):**
```json
{
  "id": "uuid-xxxx-xxxx",
  "sku": "PROD-001",
  "name": "Product Name",
  "description": "Product description",
  "price": 29.99,
  "category": "Electronics",
  "tags": ["sale", "featured"],
  "stockQuantity": 100,
  "images": ["https://example.com/image1.jpg"],
  "specifications": {
    "weight": "500g",
    "dimensions": "10x5x2 cm"
  },
  "attributes": {
    "color": "blue",
    "size": "medium"
  },
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Product not found"
}
```

---

### Create Product

**POST** `/api/products`

Create a new product.

**Request Body:**
```json
{
  "sku": "PROD-002",
  "name": "New Product",
  "description": "Product description",
  "price": 49.99,
  "category": "Clothing",
  "tags": ["new", "summer"],
  "stockQuantity": 50,
  "images": ["https://example.com/product.jpg"],
  "specifications": {
    "material": "cotton"
  },
  "attributes": {
    "color": "red",
    "size": "large"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "uuid-xxxx-xxxx",
  "sku": "PROD-002",
  "name": "New Product",
  "price": 49.99,
  "category": "Clothing",
  "stockQuantity": 50,
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

### Update Product

**PUT** `/api/products/:id`

Update an existing product.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Product ID |

**Request Body:**
```json
{
  "price": 39.99,
  "stockQuantity": 45
}
```

**Response (200 OK):**
```json
{
  "id": "uuid-xxxx-xxxx",
  "sku": "PROD-002",
  "name": "New Product",
  "price": 39.99,
  "category": "Clothing",
  "stockQuantity": 45,
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Product not found"
}
```

---

### Delete Product

**DELETE** `/api/products/:id`

Delete a product (soft delete by setting isActive to false).

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Product ID |

**Response (200 OK):**
```json
{
  "message": "Product deleted successfully"
}
```

---

### Search Products

**GET** `/api/products/search/:query`

Search products by name or description.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| query | string | Search query string |

**Response (200 OK):**
```json
{
  "count": 5,
  "products": [
    {
      "id": "uuid-xxxx-xxxx",
      "sku": "PROD-001",
      "name": "Search Result Product",
      "price": 29.99,
      "category": "Electronics"
    }
  ]
}
```

---

### Health Check

**GET** `/api/products/health`

Check product service health.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "product-service",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "databases": {
    "postgres": "connected",
    "redis": "connected"
  }
}
```

---

## Order Service API

**Base URL:** `/api/v1/orders` (via gateway: `/api/orders`)

### Health Check

**GET** `/api/orders/health`

Check order service health.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "order-service",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Get User Orders

**GET** `/api/orders`

Get orders for the authenticated user.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10) |

**Response (200 OK):**
```json
{
  "total": 5,
  "page": 1,
  "limit": 10,
  "orders": [
    {
      "id": "uuid-xxxx-xxxx",
      "userId": "uuid-user-xxxx",
      "status": "confirmed",
      "totalAmount": 149.97,
      "items": [
        {
          "productId": "uuid-prod-xxxx",
          "sku": "PROD-001",
          "name": "Product 1",
          "quantity": 2,
          "price": 29.99
        }
      ],
      "shippingAddress": "123 Main St, City, Country",
      "paymentMethod": "credit_card",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Get Order By ID

**GET** `/api/orders/:id`

Get a specific order by ID.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Order ID |

**Response (200 OK):**
```json
{
  "id": "uuid-xxxx-xxxx",
  "userId": "uuid-user-xxxx",
  "status": "processing",
  "totalAmount": 149.97,
  "items": [
    {
      "productId": "uuid-prod-xxxx",
      "sku": "PROD-001",
      "name": "Product 1",
      "quantity": 2,
      "price": 29.99
    },
    {
      "productId": "uuid-prod-yyyy",
      "sku": "PROD-002",
      "name": "Product 2",
      "quantity": 1,
      "price": 89.99
    }
  ],
  "shippingAddress": "123 Main St, City, Country",
  "paymentMethod": "credit_card",
  "notes": "Please deliver after 5pm",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Order not found"
}
```

---

### Create Order

**POST** `/api/orders`

Create a new order.

**Request Body:**
```json
{
  "items": [
    {
      "productId": "uuid-prod-xxxx",
      "sku": "PROD-001",
      "name": "Product 1",
      "quantity": 2,
      "price": 29.99
    }
  ],
  "shippingAddress": "123 Main St, City, Country",
  "paymentMethod": "credit_card",
  "notes": "Please deliver after 5pm"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| items | array | Yes | Array of order items |
| items[].productId | string | Yes | Product ID |
| items[].sku | string | Yes | Product SKU |
| items[].name | string | Yes | Product name |
| items[].quantity | number | Yes | Quantity (min: 1) |
| items[].price | number | Yes | Unit price |
| shippingAddress | string | Yes | Delivery address |
| paymentMethod | string | Yes | Payment method |
| notes | string | No | Order notes |

**Response (201 Created):**
```json
{
  "message": "Order created successfully",
  "order": {
    "id": "uuid-xxxx-xxxx",
    "status": "pending",
    "totalAmount": 59.98,
    "items": [...],
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### Cancel Order

**PUT** `/api/orders/:id/cancel`

Cancel an order. Can only cancel orders with status: `pending`, `confirmed`, or `processing`.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Order ID |

**Response (200 OK):**
```json
{
  "message": "Order cancelled successfully",
  "order": {
    "id": "uuid-xxxx-xxxx",
    "status": "cancelled",
    "totalAmount": 149.97
  }
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Order cannot be cancelled in current status"
}
```

---

### Get All Orders (Admin)

**GET** `/api/orders/all`

Get all orders (admin only).

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10) |

**Response (200 OK):**
```json
{
  "total": 100,
  "page": 1,
  "limit": 10,
  "orders": [
    {
      "id": "uuid-xxxx-xxxx",
      "userId": "uuid-user-xxxx",
      "status": "delivered",
      "totalAmount": 199.99,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Update Order Status (Admin)

**PUT** `/api/orders/:id/status`

Update order status.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Order ID |

**Request Body:**
```json
{
  "status": "shipped"
}
```

**Valid Statuses:** `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`

**Response (200 OK):**
```json
{
  "message": "Order status updated",
  "order": {
    "id": "uuid-xxxx-xxxx",
    "status": "shipped",
    "updatedAt": "2024-01-15T12:00:00.000Z"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Invalid status"
}
```

---

## Inventory Service API

**Base URL:** `/api/v1/inventory` (via gateway: `/api/inventory`)

### Get All Inventory

**GET** `/api/inventory`

Get all inventory items.

**Response (200 OK):**
```json
{
  "count": 50,
  "items": [
    {
      "id": "uuid-xxxx-xxxx",
      "sku": "PROD-001",
      "productId": "uuid-prod-xxxx",
      "warehouseId": "uuid-ware-xxxx",
      "quantity": 100,
      "reservedQuantity": 5,
      "minimumStock": 10,
      "location": "A-1-1",
      "lastRestocked": "2024-01-10T10:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Get Stock By SKU

**GET** `/api/inventory/:sku`

Get stock level for a specific product.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| sku | string | Product SKU |

**Response (200 OK):**
```json
{
  "sku": "PROD-001",
  "productId": "uuid-prod-xxxx",
  "warehouseId": "uuid-ware-xxxx",
  "quantity": 100,
  "reservedQuantity": 5,
  "minimumStock": 10,
  "location": "A-1-1",
  "lastRestocked": "2024-01-10T10:00:00.000Z",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Product not found in inventory"
}
```

---

### Get Low Stock Items

**GET** `/api/inventory/low-stock`

Get items below minimum stock level.

**Response (200 OK):**
```json
{
  "count": 3,
  "items": [
    {
      "id": "uuid-xxxx-xxxx",
      "sku": "PROD-005",
      "quantity": 5,
      "minimumStock": 10
    }
  ]
}
```

---

### Create Inventory Record

**POST** `/api/inventory`

Create a new inventory record.

**Request Body:**
```json
{
  "sku": "PROD-001",
  "productId": "uuid-prod-xxxx",
  "warehouseId": "uuid-ware-xxxx",
  "quantity": 100,
  "minimumStock": 10,
  "location": "A-1-1"
}
```

**Response (201 Created):**
```json
{
  "message": "Inventory record created successfully",
  "inventory": {
    "id": "uuid-xxxx-xxxx",
    "sku": "PROD-001",
    "productId": "uuid-prod-xxxx",
    "warehouseId": "uuid-ware-xxxx",
    "quantity": 100,
    "minimumStock": 10,
    "location": "A-1-1",
    "lastRestocked": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### Update Inventory

**PUT** `/api/inventory/:id`

Update inventory record details.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Inventory ID |

**Request Body:**
```json
{
  "minimumStock": 15,
  "location": "B-2-3"
}
```

**Response (200 OK):**
```json
{
  "message": "Inventory updated successfully",
  "inventory": {
    "id": "uuid-xxxx-xxxx",
    "sku": "PROD-001",
    "quantity": 100,
    "minimumStock": 15,
    "location": "B-2-3"
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "Inventory record not found"
}
```

---

### Adjust Stock

**PUT** `/api/inventory/:id/adjust`

Adjust stock quantity (positive or negative).

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Inventory ID |

**Request Body:**
```json
{
  "adjustment": 50
}
```

**Response (200 OK):**
```json
{
  "sku": "PROD-001",
  "quantity": 150,
  "message": "Stock adjusted successfully"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Adjustment must be a number"
}
```

---

### Reserve Stock

**POST** `/api/inventory/reserve`

Reserve stock for an order (30-minute reservation).

**Request Body:**
```json
{
  "orderId": "uuid-order-xxxx",
  "items": [
    {
      "sku": "PROD-001",
      "quantity": 5
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "message": "Stock reserved successfully",
  "orderId": "uuid-order-xxxx",
  "reservations": [
    {
      "sku": "PROD-001",
      "quantity": 5
    }
  ],
  "expiresIn": "30 minutes"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Insufficient stock for SKU PROD-001"
}
```

---

### Release Reservation

**POST** `/api/inventory/release/:orderId`

Release reserved stock for an order.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| orderId | string | Order ID |

**Request Body:**
```json
{
  "items": [
    {
      "sku": "PROD-001",
      "quantity": 5
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "message": "Reservation released successfully",
  "orderId": "uuid-order-xxxx"
}
```

---

### Confirm Reservation

**POST** `/api/inventory/confirm/:orderId`

Confirm reservation and deduct from available stock.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| orderId | string | Order ID |

**Response (200 OK):**
```json
{
  "message": "Reservation confirmed",
  "orderId": "uuid-order-xxxx"
}
```

---

## Dashboard Service API

**Base URL:** `/api/v1/dashboard` (direct access on port 3005)

### Health Check

**GET** `/api/v1/dashboard/health`

Check dashboard service and all dependencies health.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "dashboard-service",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "dependencies": {
    "product-service": {
      "status": "healthy",
      "responseTime": "45ms"
    },
    "order-service": {
      "status": "healthy",
      "responseTime": "32ms"
    },
    "inventory-service": {
      "status": "healthy",
      "responseTime": "28ms"
    },
    "redis": {
      "status": "healthy"
    }
  }
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "degraded",
  "service": "dashboard-service",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "dependencies": {
    "product-service": {
      "status": "healthy"
    },
    "order-service": {
      "status": "unhealthy",
      "error": "Connection refused"
    }
  }
}
```

---

### Get Dashboard Summary

**GET** `/api/v1/dashboard/summary`

Get comprehensive dashboard summary with aggregated data.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| period | string | Time period (default: `all`) |
| warehouseId | string | Filter by warehouse |

**Response (200 OK):**
```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "totalRevenue": 125000.50,
    "totalOrders": 1500,
    "totalProducts": 250,
    "lowStockItems": 12,
    "revenueByDay": [
      { "date": "2024-01-14", "revenue": 8500.25 },
      { "date": "2024-01-15", "revenue": 9200.75 }
    ],
    "ordersByStatus": {
      "pending": 45,
      "confirmed": 120,
      "processing": 80,
      "shipped": 250,
      "delivered": 980,
      "cancelled": 25
    },
    "topProducts": [
      {
        "id": "uuid-xxxx-xxxx",
        "name": "Top Selling Product",
        "soldCount": 150,
        "revenue": 4498.50
      }
    ],
    "recentOrders": [
      {
        "id": "uuid-xxxx-xxxx",
        "customer": "John Doe",
        "amount": 149.99,
        "status": "confirmed"
      }
    ]
  }
}
```

---

### Get Metrics

**GET** `/api/v1/dashboard/metrics`

Get aggregated metrics with optional date range.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Metric type: `all`, `revenue`, `orders`, `products` (default: `all`) |
| dateFrom | date | Start date (ISO format) |
| dateTo | date | End date (ISO format) |

**Response (200 OK):**
```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "revenue": {
      "total": 125000.50,
      "average": 4166.68,
      "growth": 12.5,
      "byCategory": {
        "Electronics": 45000.00,
        "Clothing": 35000.00,
        "Home": 25000.00,
        "Other": 20000.50
      }
    },
    "orders": {
      "total": 1500,
      "average": 50,
      "growth": 8.2,
      "byStatus": {...}
    },
    "products": {
      "total": 250,
      "active": 235,
      "lowStock": 12,
      "outOfStock": 3
    }
  }
}
```

---

### Get Inventory Statistics

**GET** `/api/v1/dashboard/inventory`

Get inventory-related statistics.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| warehouseId | string | Filter by warehouse |

**Response (200 OK):**
```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "totalItems": 5000,
    "totalValue": 250000.00,
    "lowStockCount": 12,
    "outOfStockCount": 3,
    "byWarehouse": [
      {
        "warehouseId": "uuid-ware-xxxx",
        "name": "Main Warehouse",
        "items": 3000,
        "value": 150000.00
      }
    ],
    "byCategory": [
      {
        "category": "Electronics",
        "items": 150,
        "value": 75000.00
      }
    ],
    "turnoverRate": 4.5,
    "averageStockLevel": 65
  }
}
```

---

### Get Product Statistics

**GET** `/api/v1/dashboard/products`

Get product-related statistics.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter by category |

**Response (200 OK):**
```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "totalProducts": 250,
    "activeProducts": 235,
    "inactiveProducts": 15,
    "byCategory": [
      { "category": "Electronics", "count": 45, "revenue": 45000.00 },
      { "category": "Clothing", "count": 80, "revenue": 35000.00 }
    ],
    "topSelling": [
      {
        "id": "uuid-xxxx-xxxx",
        "name": "Product Name",
        "soldUnits": 500,
        "revenue": 14999.50
      }
    ],
    "slowMoving": [
      {
        "id": "uuid-yyyy-yyyy",
        "name": "Slow Moving Product",
        "soldUnits": 5,
        "daysSinceLastSale": 30
      }
    ],
    "averagePrice": 99.99,
    "priceRange": {
      "min": 9.99,
      "max": 999.99,
      "average": 99.99
    }
  }
}
```

---

### Get Order Statistics

**GET** `/api/v1/dashboard/orders`

Get order-related statistics.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| dateFrom | date | Start date |
| dateTo | date | End date |
| status | string | Filter by status |

**Response (200 OK):**
```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "totalOrders": 1500,
    "pendingOrders": 45,
    "completedOrders": 1450,
    "cancelledOrders": 25,
    "averageOrderValue": 83.33,
    "totalRevenue": 125000.50,
    "byStatus": {
      "pending": 45,
      "confirmed": 120,
      "processing": 80,
      "shipped": 250,
      "delivered": 980,
      "cancelled": 25
    },
    "byDay": [
      { "date": "2024-01-14", "orders": 55, "revenue": 8500.25 },
      { "date": "2024-01-15", "orders": 62, "revenue": 9200.75 }
    ],
    "byPaymentMethod": {
      "credit_card": 800,
      "debit_card": 400,
      "paypal": 200,
      "bank_transfer": 100
    },
    "conversionRate": 3.5,
    "returnRate": 1.2
  }
}
```

---

### Invalidate Cache

**POST** `/api/v1/dashboard/cache/invalidate`

Clear the dashboard cache to force fresh data retrieval.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Dashboard cache invalidated successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

### Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Rate Limiting

The API Gateway implements rate limiting:
- **Window:** 15 minutes
- **Limit:** 100 requests per IP

**429 Response:**
```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

---

## Versioning

API versioning is handled via the URL path:
- Current version: `v1`
- Example: `/api/v1/products`

---

## Additional Resources

- **Swagger UI:** `/api-docs` (via API Gateway)
- **Service Health:** Each service exposes a `/health` endpoint

---

*Last Updated: 2024-01-15*
