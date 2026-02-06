/**
 * Test Fixtures - Sample Data
 * Provides sample data for testing all CloudRetail services
 */

// Sample users for testing
const sampleUsers = {
  admin: {
    id: 'test-admin-001',
    email: 'admin@test.com',
    password: 'Admin123!',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  customer: {
    id: 'test-customer-001',
    email: 'customer@test.com',
    password: 'Customer123!',
    firstName: 'Test',
    lastName: 'Customer',
    role: 'customer',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  vendor: {
    id: 'test-vendor-001',
    email: 'vendor@test.com',
    password: 'Vendor123!',
    firstName: 'Test',
    lastName: 'Vendor',
    role: 'vendor',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

// Sample products for testing
const sampleProducts = [
  {
    id: 'test-product-001',
    name: 'Test Electronics Item',
    description: 'A test electronic product',
    price: 99.99,
    category: 'electronics',
    sku: 'TEST-ELEC-001',
    vendorId: 'test-vendor-001',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'test-product-002',
    name: 'Test Clothing Item',
    description: 'A test clothing product',
    price: 49.99,
    category: 'clothing',
    sku: 'TEST-CLOTH-001',
    vendorId: 'test-vendor-001',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'test-product-003',
    name: 'Test Food Item',
    description: 'A test food product',
    price: 9.99,
    category: 'food',
    sku: 'TEST-FOOD-001',
    vendorId: 'test-vendor-001',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'test-product-004',
    name: 'Test Home Item',
    description: 'A test home product',
    price: 199.99,
    category: 'home',
    sku: 'TEST-HOME-001',
    vendorId: 'test-vendor-001',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Sample inventory for testing
const sampleInventory = [
  {
    id: 'test-inventory-001',
    productId: 'test-product-001',
    quantity: 100,
    reservedQuantity: 10,
    reorderLevel: 20,
    reorderQuantity: 50,
    warehouseLocation: 'A1-B2',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'test-inventory-002',
    productId: 'test-product-002',
    quantity: 50,
    reservedQuantity: 5,
    reorderLevel: 10,
    reorderQuantity: 25,
    warehouseLocation: 'A1-B3',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'test-inventory-003',
    productId: 'test-product-003',
    quantity: 500,
    reservedQuantity: 50,
    reorderLevel: 100,
    reorderQuantity: 200,
    warehouseLocation: 'A1-B4',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Sample orders for testing
const sampleOrders = [
  {
    id: 'test-order-001',
    customerId: 'test-customer-001',
    status: 'pending',
    totalAmount: 149.98,
    shippingAddress: '123 Test Street, Test City, TC 12345',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'test-order-002',
    customerId: 'test-customer-001',
    status: 'confirmed',
    totalAmount: 99.99,
    shippingAddress: '456 Test Avenue, Test Town, TT 67890',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'test-order-003',
    customerId: 'test-customer-001',
    status: 'shipped',
    totalAmount: 209.97,
    shippingAddress: '789 Test Boulevard, Test City, TC 54321',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Sample order items for testing
const sampleOrderItems = [
  {
    id: 'test-order-item-001',
    orderId: 'test-order-001',
    productId: 'test-product-001',
    quantity: 1,
    unitPrice: 99.99,
    totalPrice: 99.99,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'test-order-item-002',
    orderId: 'test-order-001',
    productId: 'test-product-002',
    quantity: 1,
    unitPrice: 49.99,
    totalPrice: 49.99,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Helper functions for creating test data
const createUserData = (overrides = {}) => ({
  ...sampleUsers.customer,
  ...overrides,
});

const createProductData = (overrides = {}) => ({
  ...sampleProducts[0],
  ...overrides,
});

const createInventoryData = (overrides = {}) => ({
  ...sampleInventory[0],
  ...overrides,
});

const createOrderData = (overrides = {}) => ({
  ...sampleOrders[0],
  ...overrides,
});

const createOrderItemData = (overrides = {}) => ({
  ...sampleOrderItems[0],
  ...overrides,
});

module.exports = {
  sampleUsers,
  sampleProducts,
  sampleInventory,
  sampleOrders,
  sampleOrderItems,
  createUserData,
  createProductData,
  createInventoryData,
  createOrderData,
  createOrderItemData,
};
