const { HttpError } = require('../http');
const { lockSeats, rollback } = require('./holds');
const { newTicketCode } = require('./tickets');
const { getBooking } = require('./bookings');

// The hold is checked again under the same row locks. The timer in the
// browser is not what stops two sales of one seat.
async function checkout(pool, { userId, eventId, seatIds }) {
  const client = await pool.connect();
  let bookingId;
  try {
    await client.query('BEGIN');
    const seats = await lockSeats(client, eventId, seatIds);

    const sold = await client.query(
      'SELECT seat_id FROM booking_seats WHERE seat_id = ANY($1::uuid[])',
      [seatIds]
    );
    if (sold.rowCount > 0) {
      throw new HttpError(409, 'One or more seats are already booked');
    }

    const holds = await client.query(
      `SELECT seat_id
         FROM seat_holds
        WHERE seat_id = ANY($1::uuid[])
          AND user_id = $2
          AND expires_at > now()`,
      [seatIds, userId]
    );
    if (holds.rowCount !== seatIds.length) {
      throw new HttpError(409, 'Your seat hold expired. Choose the seats again.');
    }

    const totalCents = seats.reduce((sum, seat) => sum + seat.price_cents, 0);
    const inserted = await client.query(
      `INSERT INTO bookings (user_id, event_id, status, total_cents)
       VALUES ($1, $2, 'confirmed', $3)
       RETURNING id`,
      [userId, eventId, totalCents]
    );
    bookingId = inserted.rows[0].id;

    for (const seat of seats) {
      await client.query(
        `INSERT INTO booking_seats (seat_id, booking_id, price_cents)
         VALUES ($1, $2, $3)`,
        [seat.id, bookingId, seat.price_cents]
      );
      await client.query(
        `INSERT INTO tickets (booking_id, seat_id, code)
         VALUES ($1, $2, $3)`,
        [bookingId, seat.id, newTicketCode()]
      );
    }

    await client.query('DELETE FROM seat_holds WHERE seat_id = ANY($1::uuid[])', [seatIds]);
    await client.query('COMMIT');
  } catch (err) {
    await rollback(client);
    if (err.code === '23505') {
      throw new HttpError(409, 'One or more seats are already booked');
    }
    throw err;
  } finally {
    client.release();
  }

  return getBooking(pool, userId, bookingId);
}

module.exports = { checkout };
