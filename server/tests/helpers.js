const request = require('supertest');
const { pool } = require('../src/db');
const { migrate } = require('../src/migrate');

async function resetDatabase() {
  const url = process.env.DATABASE_URL || '';
  if (!url.includes('ticketwave_test')) {
    throw new Error('Refusing to reset a database that is not ticketwave_test');
  }
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
  await migrate(pool);
}

async function register(app, overrides = {}) {
  const body = {
    name: overrides.name || 'Ada Lopez',
    email: overrides.email || `ada-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
    password: overrides.password || 'correct-horse',
  };
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.status !== 201) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { ...body, token: res.body.token, user: res.body.user };
}

async function insertEvent() {
  const starts = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const slug = `show-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const event = await pool.query(
    `INSERT INTO events (slug, title, artist, venue, city, description, starts_at)
     VALUES ($1, 'Late Set', 'Mara Ellison Quartet', 'Blue Note Room', 'Berkeley', 'A short set.', $2)
     RETURNING id`,
    [slug, starts]
  );
  const eventId = event.rows[0].id;
  const seats = await pool.query(
    `INSERT INTO seats (event_id, section, section_rank, row_label, seat_number, price_cents)
     VALUES
       ($1, 'Orchestra', 1, 'A', 1, 5000),
       ($1, 'Orchestra', 1, 'A', 2, 5000),
       ($1, 'Balcony', 3, 'B', 1, 3000)
     RETURNING id, price_cents, section, section_rank, row_label, seat_number`,
    [eventId]
  );
  seats.rows.sort((a, b) => a.section_rank - b.section_rank || a.seat_number - b.seat_number);
  return { eventId, seats: seats.rows };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { resetDatabase, register, insertEvent, auth, pool };
