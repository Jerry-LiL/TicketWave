const { HttpError } = require('./http');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_SEATS = 6;

function requireString(value, field, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new HttpError(400, `${field} must be between ${min} and ${max} characters`);
  }
  return trimmed;
}

function requirePassword(value, { min = 8 } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > 72) {
    throw new HttpError(400, `Password must be between ${min} and 72 characters`);
  }
  return value;
}

function requireEmail(value) {
  const email = requireString(value, 'Email', { max: 200 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email');
  }
  return email;
}

function requireUuid(value, field) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new HttpError(400, `Invalid ${field}`);
  }
  return value;
}

function requireSeatIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, 'Select at least one seat');
  }
  if (value.length > MAX_SEATS) {
    throw new HttpError(400, `You can hold up to ${MAX_SEATS} seats at a time`);
  }
  const ids = value.map((id) => requireUuid(id, 'seat id'));
  if (new Set(ids).size !== ids.length) {
    throw new HttpError(400, 'Duplicate seats in request');
  }
  return ids;
}

module.exports = {
  MAX_SEATS,
  requireString,
  requirePassword,
  requireEmail,
  requireUuid,
  requireSeatIds,
};
