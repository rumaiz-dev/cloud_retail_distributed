/**
 * JWT Token Generator for Testing
 * Provides utility functions for generating test JWT tokens
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Test JWT configuration
const getTestJwtConfig = () => ({
  secret: process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing',
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  algorithm: 'HS256',
});

// Generate a test JWT token
const generateTestToken = (payload, options = {}) => {
  const config = getTestJwtConfig();
  const tokenPayload = {
    userId: payload.userId || 'test-user-id',
    email: payload.email || 'test@example.com',
    role: payload.role || 'customer',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (options.expiresInSeconds || 3600),
    ...payload,
  };

  return jwt.sign(tokenPayload, config.secret, {
    algorithm: config.algorithm,
    expiresIn: options.expiresIn || config.expiresIn,
  });
};

// Generate an expired test JWT token
const generateExpiredTestToken = (payload = {}) => {
  const config = getTestJwtConfig();
  const tokenPayload = {
    userId: payload.userId || 'test-user-id',
    email: payload.email || 'test@example.com',
    role: payload.role || 'customer',
    iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    ...payload,
  };

  return jwt.sign(tokenPayload, config.secret, { algorithm: config.algorithm });
};

// Generate an invalid JWT token
const generateInvalidToken = () => {
  return 'invalid.jwt.token.' + crypto.randomBytes(16).toString('hex');
};

// Verify a JWT token
const verifyTestToken = (token, options = {}) => {
  const config = getTestJwtConfig();
  try {
    return jwt.verify(token, config.secret, {
      algorithms: [config.algorithm],
      ...options,
    });
  } catch (error) {
    if (options.throwError) {
      throw error;
    }
    return null;
  }
};

// Generate tokens for different user roles
const generateTestTokens = () => ({
  admin: generateTestToken({
    userId: 'test-admin-id',
    email: 'admin@test.com',
    role: 'admin',
  }),
  customer: generateTestToken({
    userId: 'test-customer-id',
    email: 'customer@test.com',
    role: 'customer',
  }),
  vendor: generateTestToken({
    userId: 'test-vendor-id',
    email: 'vendor@test.com',
    role: 'vendor',
  }),
});

module.exports = {
  getTestJwtConfig,
  generateTestToken,
  generateExpiredTestToken,
  generateInvalidToken,
  verifyTestToken,
  generateTestTokens,
};
