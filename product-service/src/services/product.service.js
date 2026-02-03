const productRepository = require('../repositories/product.repository');
const { redisClient, getRabbitChannel } = require('../config/database');
const logger = require('../utils/logger');

const CACHE_TTL = 300; // 5 minutes

class ProductService {
  async getProducts(options = {}) {
    const cacheKey = `products:${options.category || 'all'}`;
    
    // Try cache first
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const products = await productRepository.findAll(options);
    
    // Cache for 5 minutes
    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(products));
    
    return products;
  }

  async getProductById(id) {
    const cacheKey = `product:${id}`;
    
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const product = await productRepository.findById(id);
    if (!product) return null;

    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(product));
    return product;
  }

  async createProduct(data) {
    const product = await productRepository.create(data);
    
    // Clear cache
    await redisClient.del('products:all');
    
    // Publish event
    this.publishEvent('product.created', {
      event: 'PRODUCT_CREATED',
      productId: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`Product created: ${product.sku}`);
    return product;
  }

  async updateProduct(id, data) {
    const product = await productRepository.update(id, data);
    if (!product) return null;
    
    // Clear cache
    await redisClient.del(`product:${id}`);
    await redisClient.del('products:all');
    
    // Publish event
    this.publishEvent('product.updated', {
      event: 'PRODUCT_UPDATED',
      productId: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      timestamp: new Date().toISOString()
    });
    
    return product;
  }

  async deleteProduct(id) {
    const product = await productRepository.softDelete(id);
    if (!product) return null;
    
    // Clear cache
    await redisClient.del(`product:${id}`);
    await redisClient.del('products:all');
    
    // Publish event
    this.publishEvent('product.deleted', {
      event: 'PRODUCT_DELETED',
      productId: product.id,
      sku: product.sku,
      timestamp: new Date().toISOString()
    });
    
    return product;
  }

  async searchProducts(query) {
    return productRepository.search(query);
  }

  publishEvent(routingKey, data) {
    const channel = getRabbitChannel();
    if (channel) {
      channel.publish('product-events', routingKey, Buffer.from(JSON.stringify(data)));
    }
  }
}

module.exports = new ProductService();
