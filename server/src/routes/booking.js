const express = require('express');
const { asyncHandler, HttpError } = require('../http');
const { requireAuth } = require('../middleware/auth');
const { requireSeatIds, requireUuid } = require('../validate');
const { checkout } = require('../services/checkout');
const { getBooking, listBookings } = require('../services/bookings');

function bookingRoutes(pool) {
  const router = express.Router();

  router.post(
    '/checkout',
    requireAuth,
    asyncHandler(async (req, res) => {
      const eventId = requireUuid(req.body?.eventId, 'event id');
      const seatIds = requireSeatIds(req.body?.seatIds);
      const booking = await checkout(pool, {
        userId: req.user.id,
        eventId,
        seatIds,
      });
      res.status(201).json({ booking });
    })
  );

  router.get(
    '/bookings',
    requireAuth,
    asyncHandler(async (req, res) => {
      const bookings = await listBookings(pool, req.user.id);
      res.json({ bookings });
    })
  );

  router.get(
    '/bookings/:bookingId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const bookingId = requireUuid(req.params.bookingId, 'booking id');
      const booking = await getBooking(pool, req.user.id, bookingId);
      if (!booking) throw new HttpError(404, 'Booking not found');
      res.json({ booking });
    })
  );

  return router;
}

module.exports = bookingRoutes;
