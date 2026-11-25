const config = require('./config');
const { pool, waitForDb } = require('./db');
const { migrate } = require('./migrate');
const { seedIfEmpty } = require('./seed');
const { startHoldSweeper } = require('./sweeper');
const { createApp } = require('./app');

async function main() {
  await waitForDb();
  await migrate(pool);
  if (config.seedOnBoot) {
    const result = await seedIfEmpty(pool);
    if (result.seeded) console.log('Seeded sample events');
  }
  startHoldSweeper(pool, config.sweeperMs);
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`TicketWave API listening on ${config.port}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
