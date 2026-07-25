const mysql = require('mysql2/promise');

let pool = null;
let _available = false;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'sona_inventory',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+00:00',
    });
  }
  return pool;
}

function initPool() {
  getPool();
}

async function testConnection() {
  try {
    const conn = await getPool().getConnection();
    conn.release();
    _available = true;
    console.log('[MySQL] Connection verified — available');
    return true;
  } catch (err) {
    _available = false;
    console.warn('[MySQL] Not available:', err.message);
    return false;
  }
}

async function ensureAvailable() {
  if (_available) return true;
  return testConnection();
}

function isAvailable() {
  return _available;
}

module.exports = { getPool, initPool, testConnection, ensureAvailable, isAvailable };
