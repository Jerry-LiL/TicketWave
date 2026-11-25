const request = require('supertest');
const { createApp } = require('../src/app');
const { closePool, pool } = require('../src/db');
const { seedIfEmpty, SHOWS, LAYOUT, SEATS_PER_ROW } = require('../src/seed');
const { resetDatabase } = require('./helpers');

const seatsPerShow = LAYOUT.reduce((sum, section) => sum + section.rows.length * SEATS_PER_ROW, 0);

describe('events', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDatabase();
    await seedIfEmpty(pool);
  });
  afterAll(closePool);

  test('lists the sample shows and their seats', async () => {
    const list = await request(app).get('/api/events');
    expect(list.status).toBe(200);
    expect(list.body.events.map((event) => event.title)).toEqual(SHOWS.map((show) => show.title));

    const first = list.body.events[0];
    expect(first.seatCount).toBe(seatsPerShow);
    expect(first.availableCount).toBe(seatsPerShow);
    expect(first.minPriceCents).toBeLessThan(first.maxPriceCents);

    const detail = await request(app).get(`/api/events/${first.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.event.venue).toBe(SHOWS[0].venue);

    const seats = await request(app).get(`/api/events/${first.id}/seats`);
    expect(seats.status).toBe(200);
    expect(seats.body.seats).toHaveLength(seatsPerShow);
    expect(seats.body.seats[0]).toMatchObject({
      section: 'Orchestra',
      row: 'A',
      number: 1,
      status: 'available',
    });
    expect(seats.body.seats.at(-1).section).toBe('Balcony');

    const missing = await request(app).get(`/api/events/${first.id}0`);
    expect(missing.status).toBe(400);
  });
});
