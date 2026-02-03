const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/user.repository');
const { publishEvent } = require('../config/database');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>}
   */
  async register(userData) {
    const { email, password, firstName, lastName, role } = userData;

    // Check if user already exists
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      const error = new Error('User already exists');
      error.statusCode = 400;
      throw error;
    }

    // Create user
    const user = await userRepository.create({
      email,
      password,
      firstName,
      lastName,
      role: role || 'customer'
    });

    // Publish registration event
    publishEvent('user-events', 'user.registered', {
      event: 'USER_REGISTERED',
      userId: user.id,
      email: user.email,
      role: user.role
    }, logger);

    logger.info(`User registered: ${user.email}`);

    // Return user without password
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    };
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>}
   */
  async login(email, password) {
    // Find user
    const user = await userRepository.findByEmail(email);
    if (!user) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    // Check if user is active
    if (!user.isActive) {
      const error = new Error('Account is deactivated');
      error.statusCode = 401;
      throw error;
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    // Update last login
    await userRepository.updateLastLogin(user.id);

    // Generate JWT
    const token = this.generateToken(user);

    // Publish login event
    publishEvent('auth-events', 'auth.login', {
      event: 'USER_LOGGED_IN',
      userId: user.id,
      email: user.email,
      role: user.role
    }, logger);

    logger.info(`User logged in: ${user.email}`);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    };
  }

  /**
   * Generate JWT token
   * @param {Object} user - User object
   * @returns {string}
   */
  generateToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '24h'
    });
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object}
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        const err = new Error('Token expired');
        err.statusCode = 401;
        throw err;
      }
      const err = new Error('Invalid token');
      err.statusCode = 401;
      throw err;
    }
  }

  /**
   * Get user profile
   * @param {string} ID
   * userId - User @returns {Promise<Object>}
   */
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    return user;
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>}
   */
  async updateProfile(userId, updateData) {
    // Remove password from update data if present
    delete updateData.password;
    delete updateData.email;
    delete updateData.role;

    const user = await userRepository.update(userId, updateData);

    // Publish profile update event
    publishEvent('user-events', 'profile.updated', {
      event: 'PROFILE_UPDATED',
      userId: user.id
    }, logger);

    logger.info(`Profile updated: ${user.email}`);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    };
  }

  /**
   * Get all users (admin only)
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getAllUsers(options = {}) {
    return userRepository.findAll(options);
  }

  /**
   * Get user by ID (admin or self)
   * @param {string} userId - User ID to fetch
   * @param {string} requesterId - ID of requesting user
   * @param {string} requesterRole - Role of requesting user
   * @returns {Promise<Object>}
   */
  async getUserById(userId, requesterId, requesterRole) {
    // Check if user is requesting their own data or is admin
    if (userId !== requesterId && requesterRole !== 'admin') {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return user;
  }
}

module.exports = new AuthService();
