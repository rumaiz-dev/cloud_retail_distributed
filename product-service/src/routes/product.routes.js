const express = require('express');
const productController = require('../controllers/product.controller');

const router = express.Router();


router.get('/', productController.getProducts.bind(productController));
router.get('/:id', productController.getProductById.bind(productController));
router.post('/', productController.createProduct.bind(productController));
router.put('/:id', productController.updateProduct.bind(productController));
router.delete('/:id', productController.deleteProduct.bind(productController));


router.get('/search/:query', productController.searchProducts.bind(productController));

module.exports = router;
