const express = require('express');
const orderController = require('../controllers/order.controller');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

// Health check (public)
router.get('/health', orderController.healthCheck.bind(orderController));

// All other routes require authentication
router.use(authenticate);

// Admin routes (must be before :id routes)
router.get('/all', requireAdmin, orderController.getAllOrders.bind(orderController));
router.put('/:id/status', requireAdmin, orderController.updateOrderStatus.bind(orderController));

// User routes
router.get('/', orderController.getUserOrders.bind(orderController));
router.get('/:id', orderController.getOrderById.bind(orderController));
router.post('/', orderController.createOrder.bind(orderController));
router.put('/:id/cancel', orderController.cancelOrder.bind(orderController));

module.exports = router;
