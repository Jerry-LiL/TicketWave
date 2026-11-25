const express = require('express');
const { asyncHandler, HttpError } = require('../http');
const { requireAuth } = require('../middleware/auth');
const { findOwnedTicket, findTicketForVerify, qrPng } = require('../services/tickets');

function readCode(value) {
  if (typeof value !== 'string' || value.length > 40) {
    throw new HttpError(404, 'Ticket not found');
  }
  return value;
}

function ticketRoutes(pool) {
  const router = express.Router();

  router.get(
    '/verify/:code',
    asyncHandler(async (req, res) => {
      const code = readCode(req.params.code);
      const row = await findTicketForVerify(pool, code);
      if (!row || row.status !== 'confirmed') {
        throw new HttpError(404, 'Ticket not found');
      }
      res.json({
        valid: true,
        code: row.code,
        holder: row.holder,
        event: {
          title: row.title,
          venue: row.venue,
          city: row.city,
          startsAt: row.starts_at,
        },
        seat: {
          section: row.section,
          row: row.row_label,
          number: row.seat_number,
        },
      });
    })
  );

  router.get(
    '/:code/qr',
    requireAuth,
    asyncHandler(async (req, res) => {
      const code = readCode(req.params.code);
      const ticket = await findOwnedTicket(pool, code, req.user.id);
      if (!ticket) throw new HttpError(404, 'Ticket not found');
      const png = await qrPng(ticket.code);
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'private, max-age=3600');
      res.send(png);
    })
  );

  return router;
}

module.exports = ticketRoutes;
