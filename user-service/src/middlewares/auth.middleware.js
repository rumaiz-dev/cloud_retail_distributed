const authService = require('../services/auth.service');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware
 * Verifies JWT token from Authorization header (Bearer token)
 * Attaches user to request object
 */
const authenticate = (req, res, next) => {
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
    const decoded = authService.verifyToken(token);

    // Attach user to request object
    req.user = decoded;
    
    logger.debug(`User authenticated: ${decoded.userId}`);
    next();
  } catch (error) {
    logger.warn('Authentication failed:', error.message);
    return res.status(401).json({
      error: {
        message: error.message || 'Invalid or expired token'
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
      logger.warn(`Access denied for user ${req.user.userId} with role ${req.user.role}. Required roles: ${roles.join(', ')}`);
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
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require authentication
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const decoded = authService.verifyToken(token);
        req.user = decoded;
      }
    }
    
    next();
  } catch (error) {
    // Token invalid or expired, but we allow the request to proceed
    next();
  }
};

module.exports = {
  authenticate,
  requireRole,
  optionalAuth
};
