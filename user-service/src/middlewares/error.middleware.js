const logger = require('../utils/logger');

/**
 * Centralized Error Handling Middleware
 */
const errorMiddleware = (err, req, res, next) => {
  // Log error with details
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Prepare error response
  const errorResponse = {
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  };

  // Add validation errors if present
  if (err.errors) {
    errorResponse.error.details = err.errors;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Not Found Handler
 * Catches requests to non-existent routes
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`
    }
  });
};

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom API Error class
 */
class APIError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'APIError';
  }
}

module.exports = {
  errorMiddleware,
  notFoundHandler,
  asyncHandler,
  APIError
};
