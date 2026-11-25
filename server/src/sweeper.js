async function sweepExpiredHolds(pool) {
  const result = await pool.query('DELETE FROM seat_holds WHERE expires_at <= now()');
  return result.rowCount;
}

function startHoldSweeper(pool, intervalMs) {
  const timer = setInterval(() => {
    sweepExpiredHolds(pool).catch((err) => {
      console.error('Failed to clear expired holds', err.message);
    });
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return () => clearInterval(timer);
}

module.exports = { sweepExpiredHolds, startHoldSweeper };
