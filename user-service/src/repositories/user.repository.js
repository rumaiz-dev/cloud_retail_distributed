const User = require('../models/user.model');

class UserRepository {
  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<User|null>}
   */
  async findByEmail(email) {
    return User.findOne({ where: { email } });
  }

  /**
   * Find user by ID
   * @param {string} id - User ID (UUID)
   * @returns {Promise<User|null>}
   */
  async findById(id) {
    return User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });
  }

  /**
   * Find user by ID with password
   * @param {string} id - User ID (UUID)
   * @returns {Promise<User|null>}
   */
  async findByIdWithPassword(id) {
    return User.findByPk(id);
  }

  /**
   * Create new user
   * @param {Object} userData - User data
   * @returns {Promise<User>}
   */
  async create(userData) {
    return User.create(userData);
  }

  /**
   * Update user by ID
   * @param {string} id - User ID (UUID)
   * @param {Object} userData - User data to update
   * @returns {Promise<User>}
   */
  async update(id, userData) {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user.update(userData);
  }

  /**
   * Find all users with optional options
   * @param {Object} options - Query options
   * @returns {Promise<User[]>}
   */
  async findAll(options = {}) {
    const defaultOptions = {
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      ...options
    };
    return User.findAll(defaultOptions);
  }

  /**
   * Soft delete user by ID
   * @param {string} id - User ID (UUID)
   * @returns {Promise<User>}
   */
  async deactivate(id) {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user.update({ isActive: false });
  }

  /**
   * Update last login timestamp
   * @param {string} id - User ID (UUID)
   * @returns {Promise<User>}
   */
  async updateLastLogin(id) {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user.update({ lastLogin: new Date() });
  }
}

module.exports = new UserRepository();
