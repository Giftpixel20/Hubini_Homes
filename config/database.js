const mysql = require('mysql2/promise');

let pool = null;

const createPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hubini_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
};

const getPool = () => {
  if (!pool) {
    return createPool();
  }
  return pool;
};

const testConnection = async () => {
  try {
    const connection = await getPool().getConnection();
    console.log(' Connected to MySQL database');
    connection.release();
    return true;
  } catch (error) {
    console.error(' Database connection failed:', error.message);
    return false;
  }
};

// Helper function to execute queries
const query = async (sql, params = []) => {
  const [results] = await getPool().execute(sql, params);
  return results;
};

// Transaction helper
const transaction = async (callback) => {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  createPool,
  getPool,
  testConnection,
  query,
  transaction
};
