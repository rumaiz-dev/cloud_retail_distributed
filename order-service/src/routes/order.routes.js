const express = require('express');
const orderController = require('../controllers/order.controller');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();


router.get('/health', orderController.healthCheck.bind(orderController));


router.use(authenticate);


router.get('/all', requireAdmin, orderController.getAllOrders.bind(orderController));
router.put('/:id/status', requireAdmin, orderController.updateOrderStatus.bind(orderController));


router.get('/', orderController.getUserOrders.bind(orderController));
router.get('/:id', orderController.getOrderById.bind(orderController));
router.post('/', orderController.createOrder.bind(orderController));
router.put('/:id/cancel', orderController.cancelOrder.bind(orderController));

module.exports = router;
