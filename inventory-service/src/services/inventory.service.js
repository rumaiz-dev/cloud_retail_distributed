const { sequelize } = require('../config/database');
const inventoryRepository = require('../repositories/inventory.repository');
const { publishEvent } = require('../config/database');
const logger = require('../utils/logger');

class InventoryService {
  async getStock(sku) {
    const inventory = await inventoryRepository.findBySku(sku);
    if (!inventory) {
      throw new Error('Product not found in inventory');
    }
    return inventory;
  }

  async getAllInventory(options = {}) {
    return await inventoryRepository.findAll(options);
  }

  async createInventory(data) {
    const inventoryData = {
      ...data,
      lastRestocked: data.lastRestocked || new Date()
    };
    return await inventoryRepository.create(inventoryData);
  }

  async updateStock(id, data) {
    return await inventoryRepository.update(id, data);
  }

  async adjustStock(id, adjustment) {
    return await inventoryRepository.adjustQuantity(id, adjustment);
  }

  async reserveStock(sku, orderId, quantity) {
    const inventory = await inventoryRepository.findBySku(sku);
    if (!inventory) {
      throw new Error(`Product ${sku} not found in inventory`);
    }

    const availableStock = inventory.quantity - inventory.reservedQuantity;
    if (availableStock < quantity) {
      throw new Error(`Insufficient stock for ${sku}`);
    }

    inventory.quantity -= quantity;
    inventory.reservedQuantity += quantity;
    await inventory.save();

    await publishEvent('inventory-events', 'stock.reserved', {
      event: 'STOCK_RESERVED',
      sku,
      orderId,
      quantity,
      reservedQuantity: inventory.reservedQuantity
    });

    logger.info(`Stock reserved: ${sku} for order ${orderId}, quantity: ${quantity}`);
    return inventory;
  }

  async releaseReservation(orderId, items) {
    if (!items || !Array.isArray(items)) {
      throw new Error('Items list is required');
    }

    for (const item of items) {
      const inventory = await inventoryRepository.findBySku(item.sku);
      if (inventory) {
        inventory.quantity += item.quantity;
        inventory.reservedQuantity = Math.max(0, inventory.reservedQuantity - item.quantity);
        await inventory.save();
      }
    }

    logger.info(`Released reservation for order ${orderId}`);
    return { message: 'Reservation released', orderId };
  }

  async confirmReservation(orderId) {
    logger.info(`Reservation confirmed for order ${orderId}`);
    return { message: 'Reservation confirmed', orderId };
  }

  async getLowStockItems() {
    const inventory = await inventoryRepository.findAll();
    return inventory.filter(item => item.quantity <= item.minimumStock);
  }

  async checkAndReserveStock(orderId, items) {
    const result = await sequelize.transaction(async (t) => {
      // Check stock for all items
      for (const item of items) {
        const inventory = await inventoryRepository.findBySku(item.sku);
        const stock = inventory ? inventory.quantity : 0;
        
        if (stock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.sku}`);
        }
      }
      
      // Reserve stock for all items
      for (const item of items) {
        await this.reserveStock(item.sku, orderId, item.quantity);
      }
      
      return { success: true };
    });

    if (result.success) {
      await publishEvent('inventory-events', 'stock.reserved', {
        event: 'STOCK_RESERVED',
        orderId,
        items: items.map(i => ({ sku: i.sku, quantity: i.quantity }))
      });
    }

    return result;
  }

  async releaseReservedStock(orderId, items) {
    return await this.releaseReservation(orderId, items);
  }
}

module.exports = new InventoryService();
