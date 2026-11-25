const jwt = require('jsonwebtoken');
const config = require('../config');
const { HttpError } = require('../http');

function readToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function userFromToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  return { id: payload.sub, email: payload.email };
}

function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next(new HttpError(401, 'Sign in to continue'));
  try {
    req.user = userFromToken(token);
    return next();
  } catch {
    return next(new HttpError(401, 'Sign in to continue'));
  }
}

function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next();
  try {
    req.user = userFromToken(token);
  } catch {
    // A stale token should not block public seat maps.
  }
  return next();
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

module.exports = { requireAuth, optionalAuth, signToken };
