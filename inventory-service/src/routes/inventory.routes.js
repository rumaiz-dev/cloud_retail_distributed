const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');


router.get('/', inventoryController.getAllInventory);


router.get('/low-stock', inventoryController.getLowStockItems);


router.get('/:sku', inventoryController.getStock);


router.post('/', inventoryController.createInventory);


router.put('/:id', inventoryController.updateInventory);


router.put('/:id/adjust', inventoryController.adjustStock);


router.post('/reserve', inventoryController.reserveStock);


router.post('/release/:orderId', inventoryController.releaseReservation);


router.post('/confirm/:orderId', inventoryController.confirmReservation);

module.exports = router;
