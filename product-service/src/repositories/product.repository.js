const { Op, literal } = require('sequelize');
const Product = require('../models/product.model');

class ProductRepository {
  async findAll(options = {}) {
    const { category, page = 1, limit = 20, sort = 'created_at', order = 'ASC', includeInactive = false } = options;
    
    const where = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    if (category) {
      where.category = category;
    }

    return Product.findAll({
      where,
      order: [[literal('"created_at"'), order]],
      offset: (page - 1) * limit,
      limit: parseInt(limit)
    });
  }

  async findById(id) {
    return Product.findByPk(id);
  }

  async create(data) {
    return Product.create(data);
  }

  async update(id, data) {
    const product = await Product.findByPk(id);
    if (!product) return null;
    
    await product.update(data);
    return product;
  }

  async softDelete(id) {
    const product = await Product.findByPk(id);
    if (!product) return null;
    
    await product.update({ isActive: false });
    return product;
  }

  async search(query) {
    return Product.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } },
          { tags: { [Op.contains]: [query] } }
        ],
        isActive: true
      },
      limit: 20
    });
  }
}

module.exports = new ProductRepository();
