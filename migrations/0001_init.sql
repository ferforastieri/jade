PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_attempts (
  bucket_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_attempts_window_idx ON auth_attempts(window_start);

CREATE TABLE IF NOT EXISTS tributes (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  born_on TEXT,
  remembered_on TEXT,
  epitaph TEXT NOT NULL DEFAULT '',
  story TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted')),
  layout TEXT NOT NULL DEFAULT 'room' CHECK (layout IN ('room', 'simple')),
  theme TEXT NOT NULL DEFAULT 'dawn',
  photo_key TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tributes_public_idx ON tributes(visibility, updated_at DESC);
CREATE INDEX IF NOT EXISTS tributes_owner_idx ON tributes(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS tribute_objects (
  id TEXT PRIMARY KEY,
  tribute_id TEXT NOT NULL REFERENCES tributes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('flower', 'candle', 'book', 'lantern', 'bench')),
  x REAL NOT NULL CHECK (x >= -4.25 AND x <= 4.25),
  z REAL NOT NULL CHECK (z >= -4.25 AND z <= 4.25),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tribute_objects_room_idx ON tribute_objects(tribute_id, created_at);

CREATE TABLE IF NOT EXISTS flowers (
  id TEXT PRIMARY KEY,
  tribute_id TEXT NOT NULL REFERENCES tributes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'daisy' CHECK (kind IN ('daisy', 'rose', 'sunflower')),
  visitor_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS flowers_room_idx ON flowers(tribute_id, created_at DESC);
CREATE INDEX IF NOT EXISTS flowers_visitor_idx ON flowers(tribute_id, visitor_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS flower_rate_limits (
  tribute_id TEXT NOT NULL REFERENCES tributes(id) ON DELETE CASCADE,
  visitor_hash TEXT NOT NULL,
  last_flower_at INTEGER NOT NULL,
  PRIMARY KEY (tribute_id, visitor_hash)
);
CREATE INDEX IF NOT EXISTS flower_rate_limits_time_idx ON flower_rate_limits(last_flower_at);

-- A memorial for Jade, carried forward from the original static site.
INSERT OR IGNORE INTO tributes (
  id, slug, owner_id, name, epitaph, story, visibility, layout, theme, is_seed, created_at, updated_at
) VALUES (
  'seed-jade', 'jade', NULL, 'Jade',
  'Você sempre será a estrela que ilumina nossos corações.',
  'Sua luz, seu amor e cada lembrança continuam vivos em quem teve a alegria de te conhecer.',
  'public', 'room', 'dawn', 1,
  '2026-11-19T00:00:00.000Z', '2026-11-19T00:00:00.000Z'
);
