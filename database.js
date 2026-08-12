// database.js
// Sets up the EDUZONE SQLite database and exposes it to the rest of the app.
// The database file (eduzone.db) is created automatically on first run.

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'eduzone.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_color  TEXT DEFAULT '#169A8D',
  is_admin      INTEGER NOT NULL DEFAULT 0,
  last_login    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  subject     TEXT DEFAULT 'General',
  due_date    TEXT,
  priority    TEXT DEFAULT 'medium', -- low | medium | high
  status      TEXT DEFAULT 'pending', -- pending | done
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedule (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,      -- 0 = Sunday ... 6 = Saturday
  start_time  TEXT NOT NULL,         -- 'HH:MM'
  end_time    TEXT NOT NULL,         -- 'HH:MM'
  title       TEXT NOT NULL,
  type        TEXT DEFAULT 'class',  -- class | study | exam | personal
  color       TEXT DEFAULT '#126A80'
);

CREATE TABLE IF NOT EXISTS goals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  target_grade  INTEGER NOT NULL DEFAULT 90,
  current_grade INTEGER NOT NULL DEFAULT 0
);
`);

// Migration-safe column additions for databases created before is_admin/last_login existed.
const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!userColumns.includes('is_admin')) {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
}
if (!userColumns.includes('last_login')) {
  db.exec("ALTER TABLE users ADD COLUMN last_login TEXT");
}

module.exports = db;
