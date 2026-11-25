const express = require('express');
const cors = require('cors');
const config = require('./config');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const bookingRoutes = require('./routes/booking');
const ticketRoutes = require('./routes/tickets');
const { pool } = require('./db');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRoutes(pool));
  app.use('/api/events', eventRoutes(pool));
  app.use('/api', bookingRoutes(pool));
  app.use('/api/tickets', ticketRoutes(pool));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, _req, res, _next) => {
    if (err.code === '22P02') {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: status >= 500 ? 'Something went wrong' : err.message,
    });
  });

  return app;
}

module.exports = { createApp };
