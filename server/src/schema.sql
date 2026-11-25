-- Applied on startup. CREATE IF NOT EXISTS so a restart does not wipe data.

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  artist text NOT NULL,
  venue text NOT NULL,
  city text NOT NULL,
  description text NOT NULL,
  starts_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  section text NOT NULL,
  section_rank smallint NOT NULL,
  row_label text NOT NULL,
  seat_number integer NOT NULL CHECK (seat_number > 0),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  UNIQUE (event_id, section, row_label, seat_number)
);

CREATE INDEX IF NOT EXISTS seats_event_id_idx ON seats (event_id);

-- One live hold per seat. expires_at is what makes the hold end; the sweeper
-- only deletes rows that queries would already ignore.
CREATE TABLE IF NOT EXISTS seat_holds (
  seat_id uuid PRIMARY KEY REFERENCES seats (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seat_holds_expires_idx ON seat_holds (expires_at);
CREATE INDEX IF NOT EXISTS seat_holds_user_idx ON seat_holds (user_id);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  event_id uuid NOT NULL REFERENCES events (id),
  status text NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id);

-- Primary key on seat_id: a seat can be sold once.
CREATE TABLE IF NOT EXISTS booking_seats (
  seat_id uuid PRIMARY KEY REFERENCES seats (id),
  booking_id uuid NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  price_cents integer NOT NULL CHECK (price_cents > 0)
);

CREATE INDEX IF NOT EXISTS booking_seats_booking_idx ON booking_seats (booking_id);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  seat_id uuid NOT NULL UNIQUE REFERENCES seats (id),
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_booking_idx ON tickets (booking_id);
