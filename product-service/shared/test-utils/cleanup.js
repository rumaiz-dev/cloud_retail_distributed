/**
 * Cleanup Utilities for Tests
 * Provides utilities for cleaning up test resources
 */

/**
 * Clean up after each test
 * @param {Object} options - Cleanup options
 */
const cleanupAfterTest = async (options = {}) => {
  const { redisClient, rabbitChannel, sequelize } = options;

  // Clean up Redis
  if (redisClient && typeof redisClient.flushall === 'function') {
    try {
      await redisClient.flushall();
    } catch (error) {
      console.warn('Redis flush failed:', error.message);
    }
  }

  // Clean up RabbitMQ
  if (rabbitChannel && typeof rabbitChannel.reset === 'function') {
    rabbitChannel.reset();
  }

  // Close database connection
  if (sequelize) {
    try {
      await sequelize.close();
    } catch (error) {
      console.warn('Database close failed:', error.message);
    }
  }
};

/**
 * Clean up test tables
 * @param {Object} sequelize - Sequelize instance
 * @param {Array} models - Array of model names to clean
 */
const cleanupTestTables = async (sequelize, models = []) => {
  if (!sequelize || !sequelize.models) {
    return;
  }

  for (const modelName of models) {
    const model = sequelize.models[modelName];
    if (model) {
      try {
        await model.destroy({ truncate: true, cascade: true });
      } catch (error) {
        // Ignore errors for models that don't support truncate
      }
    }
  }
};

/**
 * Reset mocks between tests
 * @param {Object} mocks - Object containing mocks to reset
 */
const resetMocks = (mocks = {}) => {
  Object.values(mocks).forEach(mock => {
    if (mock && typeof mock.mockReset === 'function') {
      mock.mockReset();
    }
    if (mock && typeof mock.reset === 'function') {
      mock.reset();
    }
  });
};

/**
 * Clear all mocks
 */
const clearAllMocks = () => {
  jest.clearAllMocks();
};

/**
 * Restore all mocks
 */
const restoreAllMocks = () => {
  jest.restoreAllMocks();
};

/**
 * Clean up test environment
 */
const cleanupTestEnvironment = async (resources = {}) => {
  await cleanupAfterTest(resources);
  resetMocks(resources.mocks);
};

module.exports = {
  cleanupAfterTest,
  cleanupTestTables,
  resetMocks,
  clearAllMocks,
  restoreAllMocks,
  cleanupTestEnvironment,
};
