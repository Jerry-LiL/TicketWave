const { qrDataUrl } = require('./tickets');

const BOOKING_SQL = `
  SELECT b.id,
         b.event_id,
         b.status,
         b.total_cents,
         b.created_at,
         e.title,
         e.artist,
         e.venue,
         e.city,
         e.starts_at,
         t.code,
         s.section,
         s.row_label,
         s.seat_number,
         s.price_cents AS seat_price
    FROM bookings b
    JOIN events e ON e.id = b.event_id
    JOIN tickets t ON t.booking_id = b.id
    JOIN seats s ON s.id = t.seat_id
`;

function groupBookings(rows) {
  const byId = new Map();
  for (const row of rows) {
    let booking = byId.get(row.id);
    if (!booking) {
      booking = {
        id: row.id,
        eventId: row.event_id,
        status: row.status,
        totalCents: row.total_cents,
        createdAt: row.created_at,
        event: {
          title: row.title,
          artist: row.artist,
          venue: row.venue,
          city: row.city,
          startsAt: row.starts_at,
        },
        tickets: [],
      };
      byId.set(row.id, booking);
    }
    booking.tickets.push({
      code: row.code,
      section: row.section,
      row: row.row_label,
      number: row.seat_number,
      priceCents: row.seat_price,
    });
  }
  return [...byId.values()];
}

async function attachQr(bookings) {
  for (const booking of bookings) {
    for (const ticket of booking.tickets) {
      ticket.qrDataUrl = await qrDataUrl(ticket.code);
    }
  }
  return bookings;
}

async function listBookings(pool, userId) {
  const result = await pool.query(
    `${BOOKING_SQL}
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC, s.section_rank, s.row_label, s.seat_number`,
    [userId]
  );
  return attachQr(groupBookings(result.rows));
}

async function getBooking(pool, userId, bookingId) {
  const result = await pool.query(
    `${BOOKING_SQL}
      WHERE b.user_id = $1
        AND b.id = $2
      ORDER BY s.section_rank, s.row_label, s.seat_number`,
    [userId, bookingId]
  );
  const [booking] = await attachQr(groupBookings(result.rows));
  return booking || null;
}

module.exports = { listBookings, getBooking };
