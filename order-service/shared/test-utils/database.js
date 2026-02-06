/**
 * Test Database Connection Helper
 * Provides database connection management for integration tests
 */

const { Sequelize } = require('sequelize');

// Test database configuration
const getTestDatabaseConfig = () => ({
  database: process.env.TEST_DB_NAME || 'cloudretail_test',
  username: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
  host: process.env.TEST_DB_HOST || 'localhost',
  port: process.env.TEST_DB_PORT || 5432,
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// Create a new Sequelize instance for testing
const createTestSequelize = (config = {}) => {
  const dbConfig = { ...getTestDatabaseConfig(), ...config };
  return new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
      host: dbConfig.host,
      port: dbConfig.port,
      dialect: dbConfig.dialect,
      logging: dbConfig.logging ?? false,
      pool: dbConfig.pool,
    }
  );
};

// Connect to test database
const connectToTestDatabase = async () => {
  const sequelize = createTestSequelize();
  try {
    await sequelize.authenticate();
    console.log('Test database connection established successfully.');
    return sequelize;
  } catch (error) {
    console.error('Unable to connect to the test database:', error);
    throw error;
  }
};

// Close database connection
const closeTestDatabase = async (sequelize) => {
  if (sequelize) {
    await sequelize.close();
    console.log('Test database connection closed.');
  }
};

// Sync database models
const syncTestDatabase = async (sequelize, options = { force: false }) => {
  await sequelize.sync(options);
  console.log('Test database synchronized.');
};

// Clear all tables (truncate)
const clearTestDatabase = async (sequelize) => {
  const models = sequelize.models;
  for (const modelName of Object.keys(models)) {
    await models[modelName].destroy({ truncate: true, cascade: true });
  }
  console.log('Test database cleared.');
};

// Transaction helper for tests
const createTestTransaction = async (sequelize) => {
  return sequelize.transaction();
};

module.exports = {
  getTestDatabaseConfig,
  createTestSequelize,
  connectToTestDatabase,
  closeTestDatabase,
  syncTestDatabase,
  clearTestDatabase,
  createTestTransaction,
};
