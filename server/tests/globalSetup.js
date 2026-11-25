const { Client } = require('pg');
const dbUrl = require('./dbUrl');

module.exports = async function globalSetup() {
  const url = new URL(dbUrl);
  const database = url.pathname.replace(/^\//, '');
  if (!/^[a-z0-9_]+$/.test(database) || !database.endsWith('_test')) {
    throw new Error(`Refusing to create unexpected database "${database}"`);
  }

  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE ${database}`);
  }
  await client.end();
};
