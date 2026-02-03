const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`
    }
  });
};

module.exports = { errorMiddleware, notFoundHandler };
