const Inventory = require('../models/inventory.model');

class InventoryRepository {
  async findBySku(sku) {
    return await Inventory.findOne({ where: { sku } });
  }

  async findById(id) {
    return await Inventory.findByPk(id);
  }

  async findAll(options = {}) {
    return await Inventory.findAll(options);
  }

  async create(data) {
    return await Inventory.create(data);
  }

  async update(id, data) {
    const inventory = await this.findById(id);
    if (!inventory) return null;
    return await inventory.update(data);
  }

  async updateQuantity(id, quantity) {
    const inventory = await this.findById(id);
    if (!inventory) return null;
    inventory.quantity = quantity;
    return await inventory.save();
  }

  async adjustQuantity(id, adjustment) {
    const inventory = await this.findById(id);
    if (!inventory) return null;
    inventory.quantity += adjustment;
    return await inventory.save();
  }

  async incrementReserved(id, amount) {
    const inventory = await this.findById(id);
    if (!inventory) return null;
    inventory.reservedQuantity += amount;
    return await inventory.save();
  }

  async decrementReserved(id, amount) {
    const inventory = await this.findById(id);
    if (!inventory) return null;
    inventory.reservedQuantity = Math.max(0, inventory.reservedQuantity - amount);
    return await inventory.save();
  }

  async delete(id) {
    const inventory = await this.findById(id);
    if (!inventory) return false;
    await inventory.destroy();
    return true;
  }
}

module.exports = new InventoryRepository();
