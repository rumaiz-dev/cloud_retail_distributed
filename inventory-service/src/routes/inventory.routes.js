const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');

// GET /inventory - List all inventory
router.get('/', inventoryController.getAllInventory);

// GET /inventory/low-stock - Get low stock items
router.get('/low-stock', inventoryController.getLowStockItems);

// GET /inventory/:sku - Get stock by SKU
router.get('/:sku', inventoryController.getStock);

// POST /inventory - Create inventory record
router.post('/', inventoryController.createInventory);

// PUT /inventory/:id - Update inventory
router.put('/:id', inventoryController.updateInventory);

// PUT /inventory/:id/adjust - Adjust stock quantity
router.put('/:id/adjust', inventoryController.adjustStock);

// POST /inventory/reserve - Reserve stock for order
router.post('/reserve', inventoryController.reserveStock);

// POST /inventory/release/:orderId - Release reservation
router.post('/release/:orderId', inventoryController.releaseReservation);

// POST /inventory/confirm/:orderId - Confirm reservation
router.post('/confirm/:orderId', inventoryController.confirmReservation);

module.exports = router;
