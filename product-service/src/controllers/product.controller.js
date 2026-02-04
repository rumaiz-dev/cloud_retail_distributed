const Joi = require('joi');
const productService = require('../services/product.service');
const { redisClient, sequelize } = require('../config/database');
const logger = require('../utils/logger');

// Validation schemas
const createProductSchema = Joi.object({
  sku: Joi.string().required(),
  name: Joi.string().required().min(3),
  description: Joi.string().allow(''),
  price: Joi.number().min(0).required(),
  category: Joi.string().required(),
  tags: Joi.array().items(Joi.string()),
  stockQuantity: Joi.number().min(0),
  images: Joi.array().items(Joi.string()),
  specifications: Joi.object(),
  attributes: Joi.object()
});

const updateProductSchema = Joi.object({
  sku: Joi.string(),
  name: Joi.string().min(3),
  description: Joi.string().allow(''),
  price: Joi.number().min(0),
  category: Joi.string(),
  tags: Joi.array().items(Joi.string()),
  stockQuantity: Joi.number().min(0),
  images: Joi.array().items(Joi.string()),
  specifications: Joi.object(),
  attributes: Joi.object(),
  isActive: Joi.boolean()
}).min(1);

class ProductController {
  async getProducts(req, res, next) {
    try {
      const { category, page, limit, sort, includeInactive } = req.query;
      const products = await productService.getProducts({
        category,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        sort: sort || 'createdAt',
        includeInactive: includeInactive === 'true'
      });
      res.json(products);
    } catch (error) {
      next(error);
    }
  }

  async getProductById(req, res, next) {
    try {
      const product = await productService.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(product);
    } catch (error) {
      next(error);
    }
  }

  async createProduct(req, res, next) {
    try {
      const { error } = createProductSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const product = await productService.createProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req, res, next) {
    try {
      const { error } = updateProductSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const product = await productService.updateProduct(req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(product);
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req, res, next) {
    try {
      const product = await productService.deleteProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async searchProducts(req, res, next) {
    try {
      const { query } = req.params;
      const products = await productService.searchProducts(query);
      res.json(products);
    } catch (error) {
      next(error);
    }
  }

  async healthCheck(req, res, next) {
    try {
      await sequelize.authenticate();
      const postgresStatus = 'connected';
      const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
      
      res.json({
        status: 'healthy',
        service: 'product-service',
        timestamp: new Date().toISOString(),
        databases: {
          postgres: postgresStatus,
          redis: redisStatus
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'product-service',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }
}

module.exports = new ProductController();
