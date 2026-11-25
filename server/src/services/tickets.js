const { randomBytes } = require('crypto');
const QRCode = require('qrcode');
const config = require('../config');

function newTicketCode() {
  return `TW-${randomBytes(8).toString('hex').toUpperCase()}`;
}

function verifyUrl(code) {
  const base = config.publicUrl.replace(/\/$/, '');
  return `${base}/api/tickets/verify/${code}`;
}

function qrDataUrl(code) {
  return QRCode.toDataURL(verifyUrl(code), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 280,
  });
}

function qrPng(code) {
  return QRCode.toBuffer(verifyUrl(code), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 280,
    type: 'png',
  });
}

async function findOwnedTicket(pool, code, userId) {
  const result = await pool.query(
    `SELECT t.code
       FROM tickets t
       JOIN bookings b ON b.id = t.booking_id
      WHERE t.code = $1
        AND b.user_id = $2
        AND b.status = 'confirmed'`,
    [code, userId]
  );
  return result.rows[0] || null;
}

async function findTicketForVerify(pool, code) {
  const result = await pool.query(
    `SELECT t.code,
            b.status,
            u.name AS holder,
            e.title,
            e.venue,
            e.city,
            e.starts_at,
            s.section,
            s.row_label,
            s.seat_number
       FROM tickets t
       JOIN bookings b ON b.id = t.booking_id
       JOIN users u ON u.id = b.user_id
       JOIN events e ON e.id = b.event_id
       JOIN seats s ON s.id = t.seat_id
      WHERE t.code = $1`,
    [code]
  );
  return result.rows[0] || null;
}

module.exports = {
  newTicketCode,
  verifyUrl,
  qrDataUrl,
  qrPng,
  findOwnedTicket,
  findTicketForVerify,
};
