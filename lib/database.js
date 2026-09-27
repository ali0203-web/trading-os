// Database Connection & Query Module
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Initialize database schema on startup
async function initializeDatabase() {
  try {
    const schemaPath = path.join(__dirname, '../database_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schema);
    console.log('✅ Database schema initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    throw error;
  }
}

// Execute a query
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`⚠️  Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }
    return result;
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
}

// Get single row
async function getRow(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

// Get multiple rows
async function getRows(text, params = []) {
  const result = await query(text, params);
  return result.rows || [];
}

// Insert and return ID
async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
  const columns = keys.join(',');

  const text = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING id`;
  const result = await query(text, values);
  return result.rows[0].id;
}

// Update record
async function update(table, data, whereClause, whereParams) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(',');

  const params = [...values, ...whereParams];
  const text = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;

  return query(text, params);
}

// Delete record
async function deleteRecord(table, whereClause, whereParams) {
  const text = `DELETE FROM ${table} WHERE ${whereClause}`;
  return query(text, whereParams);
}

// Transaction support
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Connection pool shutdown
async function shutdown() {
  await pool.end();
  console.log('Database connection pool closed');
}

module.exports = {
  pool,
  query,
  getRow,
  getRows,
  insert,
  update,
  deleteRecord,
  transaction,
  initializeDatabase,
  shutdown,
};
