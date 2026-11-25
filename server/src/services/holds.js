const { HttpError } = require('../http');
const { MAX_SEATS } = require('../validate');

async function rollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch (err) {
    console.error('rollback failed', err.message);
  }
}

// Lock seats in primary-key order so two transactions that overlap cannot
// deadlock waiting on each other. The lock is held until commit or rollback.
async function lockSeats(client, eventId, seatIds) {
  const locked = await client.query(
    `SELECT id, price_cents
       FROM seats
      WHERE event_id = $1
        AND id = ANY($2::uuid[])
      ORDER BY id
        FOR UPDATE`,
    [eventId, seatIds]
  );
  if (locked.rowCount !== seatIds.length) {
    throw new HttpError(404, 'One or more seats do not exist for this event');
  }
  return locked.rows;
}

async function holdSeats(pool, { userId, eventId, seatIds, ttlSeconds }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockSeats(client, eventId, seatIds);

    const sold = await client.query(
      'SELECT seat_id FROM booking_seats WHERE seat_id = ANY($1::uuid[])',
      [seatIds]
    );
    if (sold.rowCount > 0) {
      throw new HttpError(409, 'One or more seats are already booked');
    }

    await client.query(
      `DELETE FROM seat_holds
        WHERE seat_id = ANY($1::uuid[])
          AND expires_at <= now()`,
      [seatIds]
    );

    const live = await client.query(
      `SELECT seat_id, user_id
         FROM seat_holds
        WHERE seat_id = ANY($1::uuid[])
          AND expires_at > now()`,
      [seatIds]
    );
    if (live.rows.some((row) => row.user_id !== userId)) {
      throw new HttpError(409, 'One or more seats are held by someone else');
    }

    const others = await client.query(
      `SELECT h.seat_id
         FROM seat_holds h
         JOIN seats s ON s.id = h.seat_id
        WHERE h.user_id = $1
          AND s.event_id = $2
          AND h.expires_at > now()
          AND NOT (h.seat_id = ANY($3::uuid[]))`,
      [userId, eventId, seatIds]
    );
    if (others.rowCount + seatIds.length > MAX_SEATS) {
      throw new HttpError(400, `You can hold up to ${MAX_SEATS} seats for an event`);
    }

    await client.query(
      `DELETE FROM seat_holds
        WHERE user_id = $1
          AND seat_id = ANY($2::uuid[])`,
      [userId, seatIds]
    );

    const inserted = await client.query(
      `INSERT INTO seat_holds (seat_id, user_id, expires_at)
       SELECT id, $2, now() + ($3 * interval '1 second')
         FROM seats
        WHERE id = ANY($1::uuid[])
       RETURNING seat_id, expires_at`,
      [seatIds, userId, ttlSeconds]
    );

    await client.query('COMMIT');
    return inserted.rows;
  } catch (err) {
    await rollback(client);
    if (err.code === '23505') {
      throw new HttpError(409, 'One or more seats are held by someone else');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function releaseHolds(pool, { userId, eventId, seatIds }) {
  const result = await pool.query(
    `DELETE FROM seat_holds h
      USING seats s
      WHERE h.seat_id = s.id
        AND h.user_id = $1
        AND s.event_id = $2
        AND h.seat_id = ANY($3::uuid[])`,
    [userId, eventId, seatIds]
  );
  return result.rowCount;
}

module.exports = { holdSeats, releaseHolds, lockSeats, rollback };
