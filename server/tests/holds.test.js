const request = require('supertest');
const { createApp } = require('../src/app');
const { closePool } = require('../src/db');
const { sweepExpiredHolds } = require('../src/sweeper');
const { resetDatabase, register, insertEvent, auth, pool } = require('./helpers');

describe('seat holds', () => {
  const app = createApp();

  beforeEach(resetDatabase);
  afterAll(closePool);

  test('a second buyer cannot take a live hold, and can take an expired one', async () => {
    const { eventId, seats } = await insertEvent();
    const seatId = seats[0].id;
    const first = await register(app, { email: 'first@example.com' });
    const second = await register(app, { email: 'second@example.com' });

    const anonymous = await request(app).post(`/api/events/${eventId}/holds`).send({ seatIds: [seatId] });
    expect(anonymous.status).toBe(401);

    const held = await request(app)
      .post(`/api/events/${eventId}/holds`)
      .set(auth(first.token))
      .send({ seatIds: [seatId] });
    expect(held.status).toBe(201);
    expect(new Date(held.body.holds[0].expiresAt).getTime()).toBeGreaterThan(Date.now());

    const blocked = await request(app)
      .post(`/api/events/${eventId}/holds`)
      .set(auth(second.token))
      .send({ seatIds: [seatId] });
    expect(blocked.status).toBe(409);

    const map = await request(app).get(`/api/events/${eventId}/seats`).set(auth(first.token));
    expect(map.body.seats.find((seat) => seat.id === seatId).status).toBe('mine');

    const otherView = await request(app).get(`/api/events/${eventId}/seats`).set(auth(second.token));
    const hidden = otherView.body.seats.find((seat) => seat.id === seatId);
    expect(hidden.status).toBe('held');
    expect(hidden.holdExpiresAt).toBeNull();

    await pool.query(`UPDATE seat_holds SET expires_at = now() - interval '1 second'`);
    const removed = await sweepExpiredHolds(pool);
    expect(removed).toBe(1);

    const taken = await request(app)
      .post(`/api/events/${eventId}/holds`)
      .set(auth(second.token))
      .send({ seatIds: [seatId] });
    expect(taken.status).toBe(201);
  });

  test('releasing a hold puts the seat back, and a sold seat cannot be held', async () => {
    const { eventId, seats } = await insertEvent();
    const buyer = await register(app, { email: 'buyer@example.com' });
    const other = await register(app, { email: 'other@example.com' });

    const held = await request(app)
      .post(`/api/events/${eventId}/holds`)
      .set(auth(buyer.token))
      .send({ seatIds: [seats[0].id, seats[1].id] });
    expect(held.status).toBe(201);

    const released = await request(app)
      .delete(`/api/events/${eventId}/holds`)
      .set(auth(buyer.token))
      .send({ seatIds: [seats[0].id] });
    expect(released.body.released).toBe(1);

    const retaken = await request(app)
      .post(`/api/events/${eventId}/holds`)
      .set(auth(other.token))
      .send({ seatIds: [seats[0].id] });
    expect(retaken.status).toBe(201);

    const booked = await request(app)
      .post('/api/checkout')
      .set(auth(other.token))
      .send({ eventId, seatIds: [seats[0].id] });
    expect(booked.status).toBe(201);

    const again = await request(app)
      .post(`/api/events/${eventId}/holds`)
      .set(auth(buyer.token))
      .send({ seatIds: [seats[0].id] });
    expect(again.status).toBe(409);

    const duplicate = await request(app)
      .post(`/api/events/${eventId}/holds`)
      .set(auth(buyer.token))
      .send({ seatIds: [seats[1].id, seats[1].id] });
    expect(duplicate.status).toBe(400);
  });

  test('refuses a seventh seat', async () => {
    const starts = new Date(Date.now() + 86400000);
    const event = await pool.query(
      `INSERT INTO events (slug, title, artist, venue, city, description, starts_at)
       VALUES ('cap-show', 'Cap', 'Cap', 'Hall', 'Oakland', 'Cap test.', $1)
       RETURNING id`,
      [starts]
    );
    const eventId = event.rows[0].id;
    const seatIds = [];
    for (let number = 1; number <= 7; number += 1) {
      const seat = await pool.query(
        `INSERT INTO seats (event_id, section, section_rank, row_label, seat_number, price_cents)
         VALUES ($1, 'Orchestra', 1, 'A', $2, 1000)
         RETURNING id`,
        [eventId, number]
      );
      seatIds.push(seat.rows[0].id);
    }
    const buyer = await register(app, { email: 'cap@example.com' });
    const tooMany = await request(app)
      .post(`/api/events/${eventId}/holds`)
      .set(auth(buyer.token))
      .send({ seatIds });
    expect(tooMany.status).toBe(400);

    const firstSix = await request(app)
      .post(`/api/events/${eventId}/holds`)
      .set(auth(buyer.token))
      .send({ seatIds: seatIds.slice(0, 6) });
    expect(firstSix.status).toBe(201);

    const seventh = await request(app)
      .post(`/api/events/${eventId}/holds`)
      .set(auth(buyer.token))
      .send({ seatIds: [seatIds[6]] });
    expect(seventh.status).toBe(400);
  });
});
