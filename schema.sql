CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  photo TEXT,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY,
  round INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  p1 INTEGER NOT NULL,
  p2 INTEGER,
  result TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reported_by INTEGER,
  reported_at TEXT,
  confirmed_at TEXT
);
INSERT OR IGNORE INTO settings (key, value) VALUES ('phase', 'registration');
