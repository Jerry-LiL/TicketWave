const request = require('supertest');
const { createApp } = require('../src/app');
const { closePool } = require('../src/db');
const { resetDatabase, register, insertEvent, auth, pool } = require('./helpers');

async function hold(app, token, eventId, seatIds) {
  return request(app).post(`/api/events/${eventId}/holds`).set(auth(token)).send({ seatIds });
}

async function buy(app, token, eventId, seatIds) {
  return request(app).post('/api/checkout').set(auth(token)).send({ eventId, seatIds });
}

describe('concurrent bookings', () => {
  const app = createApp();

  beforeEach(resetDatabase);
  afterAll(closePool);

  test('eight people grabbing one seat produce a single hold and a single booking', async () => {
    const { eventId, seats } = await insertEvent();
    const seatId = seats[0].id;
    const buyers = [];
    for (let i = 0; i < 8; i += 1) {
      buyers.push(await register(app, { email: `race-${i}@example.com`, name: `Buyer ${i}` }));
    }

    const holds = await Promise.all(buyers.map((buyer) => hold(app, buyer.token, eventId, [seatId])));
    const won = holds.filter((res) => res.status === 201);
    const lost = holds.filter((res) => res.status === 409);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(7);

    const holdRows = await pool.query('SELECT user_id FROM seat_holds');
    expect(holdRows.rowCount).toBe(1);

    const winner = buyers.find((buyer) => buyer.user.id === holdRows.rows[0].user_id);
    const booking = await buy(app, winner.token, eventId, [seatId]);
    expect(booking.status).toBe(201);
    expect(booking.body.booking.tickets).toHaveLength(1);
    expect(booking.body.booking.totalCents).toBe(5000);

    const bookings = await pool.query('SELECT id FROM bookings');
    const sold = await pool.query('SELECT seat_id FROM booking_seats');
    const tickets = await pool.query('SELECT code FROM tickets');
    expect(bookings.rowCount).toBe(1);
    expect(sold.rowCount).toBe(1);
    expect(tickets.rowCount).toBe(1);
    expect(await pool.query('SELECT 1 FROM seat_holds')).toMatchObject({ rowCount: 0 });
  });

  test('a double submit confirms the seat once', async () => {
    const { eventId, seats } = await insertEvent();
    const buyer = await register(app, { email: 'double@example.com' });
    const held = await hold(app, buyer.token, eventId, [seats[0].id, seats[2].id]);
    expect(held.status).toBe(201);

    const [first, second] = await Promise.all([
      buy(app, buyer.token, eventId, [seats[0].id, seats[2].id]),
      buy(app, buyer.token, eventId, [seats[0].id, seats[2].id]),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const bookings = await pool.query('SELECT total_cents FROM bookings');
    expect(bookings.rowCount).toBe(1);
    expect(bookings.rows[0].total_cents).toBe(8000);
    expect((await pool.query('SELECT seat_id FROM booking_seats')).rowCount).toBe(2);
  });

  test('an expired hold loses the race to a fresh one', async () => {
    const { eventId, seats } = await insertEvent();
    const seatId = seats[0].id;
    const early = await register(app, { email: 'early@example.com' });
    const late = await register(app, { email: 'late@example.com' });

    expect((await hold(app, early.token, eventId, [seatId])).status).toBe(201);
    await pool.query(`UPDATE seat_holds SET expires_at = now() - interval '1 second'`);
    expect((await hold(app, late.token, eventId, [seatId])).status).toBe(201);

    const [earlyBuy, lateBuy] = await Promise.all([
      buy(app, early.token, eventId, [seatId]),
      buy(app, late.token, eventId, [seatId]),
    ]);
    expect(earlyBuy.status).toBe(409);
    expect(lateBuy.status).toBe(201);

    const owner = await pool.query(
      `SELECT u.email
         FROM bookings b
         JOIN users u ON u.id = b.user_id`
    );
    expect(owner.rows.map((row) => row.email)).toEqual(['late@example.com']);
  });

  test('checkout without a hold does not sell the seat', async () => {
    const { eventId, seats } = await insertEvent();
    const buyers = [];
    for (let i = 0; i < 5; i += 1) {
      buyers.push(await register(app, { email: `nohold-${i}@example.com` }));
    }
    const results = await Promise.all(
      buyers.map((buyer) => buy(app, buyer.token, eventId, [seats[1].id]))
    );
    expect(results.every((res) => res.status === 409)).toBe(true);
    expect((await pool.query('SELECT id FROM bookings')).rowCount).toBe(0);
  });
});
