const fs = require('fs');
const path = require('path');

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

async function migrate(pool) {
  await pool.query(schemaSql);
}

async function main() {
  const { pool, waitForDb, closePool } = require('./db');
  try {
    await waitForDb();
    await migrate(pool);
    console.log('Schema is up to date');
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { migrate };
