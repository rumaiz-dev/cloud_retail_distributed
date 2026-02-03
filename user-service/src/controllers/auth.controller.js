const { body, param, validationResult } = require('express-validator');
const authService = require('../services/auth.service');
const logger = require('../utils/logger');

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().trim().withMessage('First name is required'),
  body('lastName').notEmpty().trim().withMessage('Last name is required'),
  body('role')
    .optional()
    .isIn(['customer', 'admin', 'vendor'])
    .withMessage('Role must be customer, admin, or vendor')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const updateProfileValidation = [
  body('firstName').optional().notEmpty().trim().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().trim().withMessage('Last name cannot be empty')
];

const userIdValidation = [
  param('id').isUUID().withMessage('Valid user ID is required')
];

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        details: errors.array()
      }
    });
  }
  next();
};

/**
 * POST /auth/register - Register new user
 */
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    
    const user = await authService.register({
      email,
      password,
      firstName,
      lastName,
      role
    });

    res.status(201).json({
      message: 'User registered successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/login - Login and return JWT token
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    const result = await authService.login(email, password);

    res.json({
      message: 'Login successful',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /auth/profile - Get current user profile (auth required)
 */
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await authService.getProfile(userId);

    res.json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /auth/profile - Update profile (auth required)
 */
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const updateData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName
    };

    const user = await authService.updateProfile(userId, updateData);

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /auth/users - Get all users (admin only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const options = {
      where: req.query,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined
    };

    const users = await authService.getAllUsers(options);

    res.json(users);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /auth/users/:id - Get user by ID (admin or self)
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requesterId = req.user.userId;
    const requesterRole = req.user.role;

    const user = await authService.getUserById(id, requesterId, requesterRole);

    res.json(user);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  getAllUsers,
  getUserById,
  registerValidation,
  loginValidation,
  updateProfileValidation,
  userIdValidation,
  handleValidationErrors
};
