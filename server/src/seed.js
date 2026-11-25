const LAYOUT = [
  { section: 'Orchestra', rank: 1, rows: ['A', 'B', 'C', 'D'], price: 'orchestra' },
  { section: 'Mezzanine', rank: 2, rows: ['E', 'F'], price: 'mezzanine' },
  { section: 'Balcony', rank: 3, rows: ['G', 'H'], price: 'balcony' },
];

const SEATS_PER_ROW = 10;

const SHOWS = [
  {
    slug: 'lantern-parade',
    title: 'Lantern Parade',
    artist: 'The Lantern Parade',
    venue: 'Fox Theater',
    city: 'Oakland',
    daysAhead: 14,
    prices: { orchestra: 8500, mezzanine: 6400, balcony: 4200 },
    description: 'Brass, drums, and songs that start quiet and end loud. Doors at 6:30, music at 7:30.',
  },
  {
    slug: 'cedar-and-rye',
    title: 'Cedar & Rye',
    artist: 'Cedar & Rye',
    venue: 'The Independent',
    city: 'San Francisco',
    daysAhead: 21,
    prices: { orchestra: 5500, mezzanine: 4500, balcony: 3200 },
    description: 'Two guitars and close harmonies, mostly from their record Dry Season. No opener.',
  },
  {
    slug: 'late-set',
    title: 'Late Set',
    artist: 'Mara Ellison Quartet',
    venue: 'Blue Note Room',
    city: 'Berkeley',
    daysAhead: 28,
    prices: { orchestra: 4800, mezzanine: 3800, balcony: 2800 },
    description: 'Standards and a few originals. Late seating happens between tunes, not during them.',
  },
  {
    slug: 'kitchen-sink',
    title: 'Kitchen Sink',
    artist: 'Kitchen Sink Comedy',
    venue: 'The Annex',
    city: 'San Jose',
    daysAhead: 36,
    prices: { orchestra: 3500, mezzanine: 2800, balcony: 2200 },
    description: 'Four comics and a host who will not stick to the set order.',
  },
];

// 7:30 in the evening, Pacific time, on a day `daysAhead` from today in Los Angeles.
function pacificEvening(daysAhead) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [year, month, day] = today.split('-').map(Number);
  let stamp = Date.UTC(year, month - 1, day + daysAhead, 12, 30, 0);

  const hourInLa = (ms) =>
    Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        hourCycle: 'h23',
      }).format(new Date(ms))
    );

  stamp += (19 - hourInLa(stamp)) * 60 * 60 * 1000;
  if (hourInLa(stamp) !== 19) {
    stamp += (19 - hourInLa(stamp)) * 60 * 60 * 1000;
  }
  return new Date(stamp);
}

async function insertShow(client, show) {
  const event = await client.query(
    `INSERT INTO events (slug, title, artist, venue, city, description, starts_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [show.slug, show.title, show.artist, show.venue, show.city, show.description, pacificEvening(show.daysAhead)]
  );
  const eventId = event.rows[0].id;

  const values = [];
  const params = [];
  for (const section of LAYOUT) {
    for (const rowLabel of section.rows) {
      for (let number = 1; number <= SEATS_PER_ROW; number += 1) {
        const start = params.length + 1;
        params.push(eventId, section.section, section.rank, rowLabel, number, show.prices[section.price]);
        const slots = [0, 1, 2, 3, 4, 5].map((offset) => `$${start + offset}`);
        values.push(`(${slots.join(', ')})`);
      }
    }
  }

  await client.query(
    `INSERT INTO seats (event_id, section, section_rank, row_label, seat_number, price_cents)
     VALUES ${values.join(', ')}`,
    params
  );
}

async function seedIfEmpty(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE events IN EXCLUSIVE MODE');
    const existing = await client.query('SELECT COUNT(*)::int AS n FROM events');
    if (existing.rows[0].n > 0) {
      await client.query('COMMIT');
      return { seeded: false };
    }
    for (const show of SHOWS) {
      await insertShow(client, show);
    }
    await client.query('COMMIT');
    return { seeded: true };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('rollback failed', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const { pool, waitForDb, closePool } = require('./db');
  const { migrate } = require('./migrate');
  try {
    await waitForDb();
    await migrate(pool);
    const result = await seedIfEmpty(pool);
    console.log(result.seeded ? 'Seeded sample events' : 'Events already present');
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seedIfEmpty, pacificEvening, SHOWS, SEATS_PER_ROW, LAYOUT };
