const axios = require('axios');
const logger = require('../utils/logger');

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3004';

/**
 * JWT Authentication Middleware
 * Verifies JWT token from Authorization header (Bearer token)
 * Attaches user to request object
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: {
          message: 'Authorization header is required'
        }
      });
    }

    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: {
          message: 'Invalid authorization header format. Use: Bearer <token>'
        }
      });
    }

    const token = parts[1];

    // Verify token with user service
    const response = await axios.get(`${USER_SERVICE_URL}/api/v1/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // Attach user to request object
    req.user = response.data;
    
    logger.debug(`User authenticated: ${req.user.id}`);
    next();
  } catch (error) {
    logger.warn('Authentication failed:', error.message);
    return res.status(401).json({
      error: {
        message: error.response?.data?.error?.message || 'Invalid or expired token'
      }
    });
  }
};

/**
 * Role-based middleware factory
 * @param {...string} roles - Allowed roles
 * @returns {Function} Middleware function
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required'
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.id} with role ${req.user.role}. Required roles: ${roles.join(', ')}`);
      return res.status(403).json({
        error: {
          message: 'Access denied. Insufficient permissions.'
        }
      });
    }

    next();
  };
};

/**
 * Admin role middleware
 * Checks if authenticated user has admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: {
        message: 'Authentication required'
      }
    });
  }

  if (req.user.role !== 'admin') {
    logger.warn(`Access denied for user ${req.user.id} with role ${req.user.role}. Admin access required.`);
    return res.status(403).json({
      error: {
        message: 'Access denied. Admin privileges required.'
      }
    });
  }

  next();
};

module.exports = {
  authenticate,
  requireRole,
  requireAdmin
};
