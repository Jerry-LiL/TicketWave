const request = require('supertest');
const { createApp } = require('../src/app');
const { closePool } = require('../src/db');
const { qrPng, verifyUrl } = require('../src/services/tickets');
const { resetDatabase, register, insertEvent, auth } = require('./helpers');

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('tickets', () => {
  const app = createApp();

  beforeEach(resetDatabase);
  afterAll(closePool);

  test('checkout issues a QR ticket that verifies', async () => {
    const { eventId, seats } = await insertEvent();
    const buyer = await register(app, { name: 'Ada Lopez', email: 'ada-ticket@example.com' });
    const stranger = await register(app, { email: 'stranger@example.com' });

    const held = await request(app)
      .post(`/api/events/${eventId}/holds`)
      .set(auth(buyer.token))
      .send({ seatIds: [seats[0].id] });
    expect(held.status).toBe(201);

    const booked = await request(app)
      .post('/api/checkout')
      .set(auth(buyer.token))
      .send({ eventId, seatIds: [seats[0].id] });
    expect(booked.status).toBe(201);

    const ticket = booked.body.booking.tickets[0];
    expect(ticket.code).toMatch(/^TW-[0-9A-F]{16}$/);
    expect(ticket.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(ticket).toMatchObject({ section: 'Orchestra', row: 'A', number: 1, priceCents: 5000 });
    expect(verifyUrl(ticket.code)).toBe(`http://localhost:4000/api/tickets/verify/${ticket.code}`);

    const png = await qrPng(ticket.code);
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);

    const image = await request(app).get(`/api/tickets/${ticket.code}/qr`).set(auth(buyer.token));
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toMatch(/image\/png/);
    expect(Buffer.isBuffer(image.body)).toBe(true);
    expect(image.body.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);

    const hidden = await request(app).get(`/api/tickets/${ticket.code}/qr`).set(auth(stranger.token));
    expect(hidden.status).toBe(404);

    const missingAuth = await request(app).get(`/api/tickets/${ticket.code}/qr`);
    expect(missingAuth.status).toBe(401);

    const verified = await request(app).get(`/api/tickets/verify/${ticket.code}`);
    expect(verified.status).toBe(200);
    expect(verified.body).toMatchObject({
      valid: true,
      code: ticket.code,
      holder: 'Ada Lopez',
      event: { title: 'Late Set', venue: 'Blue Note Room', city: 'Berkeley' },
      seat: { section: 'Orchestra', row: 'A', number: 1 },
    });
    expect(verified.body.holderEmail).toBeUndefined();

    const unknown = await request(app).get('/api/tickets/verify/TW-DOESNOTEXIST01');
    expect(unknown.status).toBe(404);

    const list = await request(app).get('/api/bookings').set(auth(buyer.token));
    expect(list.status).toBe(200);
    expect(list.body.bookings).toHaveLength(1);
    expect(list.body.bookings[0].tickets[0].code).toBe(ticket.code);

    const one = await request(app).get(`/api/bookings/${booked.body.booking.id}`).set(auth(buyer.token));
    expect(one.status).toBe(200);

    const notYours = await request(app)
      .get(`/api/bookings/${booked.body.booking.id}`)
      .set(auth(stranger.token));
    expect(notYours.status).toBe(404);
  });
});
