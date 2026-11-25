const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function integer(name, fallback, { min, max }) {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is required');
}

module.exports = {
  port: integer('PORT', 4000, { min: 1, max: 65535 }),
  databaseUrl:
    process.env.DATABASE_URL || 'postgres://ticketwave:ticketwave@localhost:5432/ticketwave',
  jwtSecret: jwtSecret || 'dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  holdTtlSeconds: integer('HOLD_TTL_SECONDS', 120, { min: 15, max: 900 }),
  bcryptRounds: integer('BCRYPT_ROUNDS', 10, { min: 4, max: 15 }),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:4000',
  seedOnBoot: process.env.SEED_ON_BOOT !== 'false',
  sweeperMs: integer('SWEEPER_INTERVAL_MS', 15000, { min: 1000, max: 600000 }),
};
