const express = require('express');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { asyncHandler, HttpError } = require('../http');
const { requireAuth, signToken } = require('../middleware/auth');
const { requireEmail, requirePassword, requireString } = require('../validate');

const dummyHash = bcrypt.hashSync('ticketwave-dummy-password', config.bcryptRounds);

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name };
}

function authRoutes(pool) {
  const router = express.Router();

  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const name = requireString(req.body?.name, 'Name', { min: 1, max: 80 });
      const email = requireEmail(req.body?.email);
      const password = requirePassword(req.body?.password);
      const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
      try {
        const result = await pool.query(
          `INSERT INTO users (email, name, password_hash)
           VALUES ($1, $2, $3)
           RETURNING id, email, name`,
          [email, name, passwordHash]
        );
        const user = publicUser(result.rows[0]);
        res.status(201).json({ token: signToken(user), user });
      } catch (err) {
        if (err.code === '23505') {
          throw new HttpError(409, 'An account with that email already exists');
        }
        throw err;
      }
    })
  );

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const email = requireEmail(req.body?.email);
      const password = requirePassword(req.body?.password, { min: 1 });
      const result = await pool.query(
        'SELECT id, email, name, password_hash FROM users WHERE email = $1',
        [email]
      );
      const row = result.rows[0];
      const matches = await bcrypt.compare(password, row ? row.password_hash : dummyHash);
      if (!row || !matches) {
        throw new HttpError(401, 'Email or password is incorrect');
      }
      const user = publicUser(row);
      res.json({ token: signToken(user), user });
    })
  );

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.user.id]);
      if (!result.rows[0]) throw new HttpError(401, 'Sign in to continue');
      res.json(publicUser(result.rows[0]));
    })
  );

  return router;
}

module.exports = authRoutes;
