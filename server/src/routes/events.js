const express = require('express');
const config = require('../config');
const { asyncHandler, HttpError } = require('../http');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { requireSeatIds, requireUuid } = require('../validate');
const { holdSeats, releaseHolds } = require('../services/holds');

const EVENT_COLUMNS = `
  e.id,
  e.slug,
  e.title,
  e.artist,
  e.venue,
  e.city,
  e.description,
  e.starts_at,
  MIN(s.price_cents)::int AS min_price_cents,
  MAX(s.price_cents)::int AS max_price_cents,
  COUNT(s.id)::int AS seat_count,
  COUNT(s.id) FILTER (
    WHERE bs.seat_id IS NULL AND h.seat_id IS NULL
  )::int AS available_count
`;

const EVENT_FROM = `
  FROM events e
  LEFT JOIN seats s ON s.event_id = e.id
  LEFT JOIN booking_seats bs ON bs.seat_id = s.id
  LEFT JOIN seat_holds h ON h.seat_id = s.id AND h.expires_at > now()
`;

function eventJson(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    artist: row.artist,
    venue: row.venue,
    city: row.city,
    description: row.description,
    startsAt: row.starts_at,
    minPriceCents: row.min_price_cents,
    maxPriceCents: row.max_price_cents,
    seatCount: row.seat_count,
    availableCount: row.available_count,
  };
}

function seatJson(row, userId) {
  let status = 'available';
  if (row.sold) status = 'sold';
  else if (row.hold_user_id && userId && row.hold_user_id === userId) status = 'mine';
  else if (row.hold_user_id) status = 'held';

  return {
    id: row.id,
    section: row.section,
    row: row.row_label,
    number: row.seat_number,
    priceCents: row.price_cents,
    status,
    holdExpiresAt: status === 'mine' ? row.hold_expires_at : null,
  };
}

function eventRoutes(pool) {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const result = await pool.query(
        `SELECT ${EVENT_COLUMNS} ${EVENT_FROM} GROUP BY e.id ORDER BY e.starts_at ASC`
      );
      res.json({ events: result.rows.map(eventJson) });
    })
  );

  router.get(
    '/:eventId',
    asyncHandler(async (req, res) => {
      const eventId = requireUuid(req.params.eventId, 'event id');
      const result = await pool.query(
        `SELECT ${EVENT_COLUMNS} ${EVENT_FROM} WHERE e.id = $1 GROUP BY e.id`,
        [eventId]
      );
      if (!result.rows[0]) throw new HttpError(404, 'Event not found');
      res.json({ event: eventJson(result.rows[0]) });
    })
  );

  router.get(
    '/:eventId/seats',
    optionalAuth,
    asyncHandler(async (req, res) => {
      const eventId = requireUuid(req.params.eventId, 'event id');
      const event = await pool.query('SELECT id FROM events WHERE id = $1', [eventId]);
      if (!event.rows[0]) throw new HttpError(404, 'Event not found');

      const result = await pool.query(
        `SELECT s.id,
                s.section,
                s.row_label,
                s.seat_number,
                s.price_cents,
                (bs.seat_id IS NOT NULL) AS sold,
                h.user_id AS hold_user_id,
                h.expires_at AS hold_expires_at
           FROM seats s
           LEFT JOIN booking_seats bs ON bs.seat_id = s.id
           LEFT JOIN seat_holds h
             ON h.seat_id = s.id
            AND h.expires_at > now()
          WHERE s.event_id = $1
          ORDER BY s.section_rank, s.row_label, s.seat_number`,
        [eventId]
      );

      res.json({
        seats: result.rows.map((row) => seatJson(row, req.user?.id)),
      });
    })
  );

  router.post(
    '/:eventId/holds',
    requireAuth,
    asyncHandler(async (req, res) => {
      const eventId = requireUuid(req.params.eventId, 'event id');
      const seatIds = requireSeatIds(req.body?.seatIds);
      const rows = await holdSeats(pool, {
        userId: req.user.id,
        eventId,
        seatIds,
        ttlSeconds: config.holdTtlSeconds,
      });
      res.status(201).json({
        holds: rows.map((row) => ({
          seatId: row.seat_id,
          expiresAt: row.expires_at,
        })),
      });
    })
  );

  router.delete(
    '/:eventId/holds',
    requireAuth,
    asyncHandler(async (req, res) => {
      const eventId = requireUuid(req.params.eventId, 'event id');
      const seatIds = requireSeatIds(req.body?.seatIds);
      const released = await releaseHolds(pool, {
        userId: req.user.id,
        eventId,
        seatIds,
      });
      res.json({ released });
    })
  );

  return router;
}

module.exports = eventRoutes;
