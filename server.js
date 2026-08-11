// server.js
// EDUZONE backend — Express + SQLite (better-sqlite3) + JWT auth (httpOnly cookie).

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
// In production, set a real secret via the JWT_SECRET environment variable.
const JWT_SECRET = process.env.JWT_SECRET || 'eduzone-dev-secret-change-me';
const COOKIE_NAME = 'eduzone_token';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------
function signToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function auth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// ---------- auth routes ----------
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Please enter your name.' });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const hash = bcrypt.hashSync(password, 10);
  const palette = ['#143051', '#126A80', '#169A8D', '#20B89A'];
  const avatar = palette[Math.floor(Math.random() * palette.length)];

  const info = db.prepare(
    'INSERT INTO users (name, email, password_hash, avatar_color) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), email.toLowerCase(), hash, avatar);

  const user = { id: info.lastInsertRowid, name: name.trim(), email: email.toLowerCase() };
  setAuthCookie(res, signToken(user));
  res.status(201).json({ user });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Please enter your email and password.' });

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const user = { id: row.id, name: row.name, email: row.email };
  setAuthCookie(res, signToken(user));
  res.json({ user });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  const row = db.prepare('SELECT id, name, email, avatar_color, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json({ user: row });
});

// ---------- tasks ----------
app.get('/api/tasks', auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM tasks WHERE user_id = ? ORDER BY (status = 'done'), due_date IS NULL, due_date ASC").all(req.user.id);
  res.json({ tasks: rows });
});

app.post('/api/tasks', auth, (req, res) => {
  const { title, subject, due_date, priority } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Task title is required.' });
  const info = db.prepare(
    'INSERT INTO tasks (user_id, title, subject, due_date, priority) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.id, title.trim(), subject || 'General', due_date || null, priority || 'medium');
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ task });
});

app.patch('/api/tasks/:id', auth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { title, subject, due_date, priority, status } = req.body || {};
  db.prepare(
    'UPDATE tasks SET title = ?, subject = ?, due_date = ?, priority = ?, status = ? WHERE id = ?'
  ).run(
    title ?? task.title,
    subject ?? task.subject,
    due_date !== undefined ? due_date : task.due_date,
    priority ?? task.priority,
    status ?? task.status,
    task.id
  );
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  res.json({ task: updated });
});

app.delete('/api/tasks/:id', auth, (req, res) => {
  const info = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.json({ ok: true });
});

// ---------- schedule ----------
app.get('/api/schedule', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM schedule WHERE user_id = ? ORDER BY day_of_week, start_time').all(req.user.id);
  res.json({ schedule: rows });
});

app.post('/api/schedule', auth, (req, res) => {
  const { day_of_week, start_time, end_time, title, type, color } = req.body || {};
  if (day_of_week === undefined || !start_time || !end_time || !title || !title.trim()) {
    return res.status(400).json({ error: 'Day, start time, end time and title are required.' });
  }
  const info = db.prepare(
    'INSERT INTO schedule (user_id, day_of_week, start_time, end_time, title, type, color) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, day_of_week, start_time, end_time, title.trim(), type || 'class', color || '#126A80');
  const item = db.prepare('SELECT * FROM schedule WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ item });
});

app.delete('/api/schedule/:id', auth, (req, res) => {
  const info = db.prepare('DELETE FROM schedule WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Schedule item not found' });
  res.json({ ok: true });
});

// ---------- goals ----------
app.get('/api/goals', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM goals WHERE user_id = ?').all(req.user.id);
  res.json({ goals: rows });
});

app.post('/api/goals', auth, (req, res) => {
  const { subject, target_grade, current_grade } = req.body || {};
  if (!subject || !subject.trim()) return res.status(400).json({ error: 'Subject is required.' });
  const info = db.prepare(
    'INSERT INTO goals (user_id, subject, target_grade, current_grade) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, subject.trim(), target_grade || 90, current_grade || 0);
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ goal });
});

app.patch('/api/goals/:id', auth, (req, res) => {
  const goal = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const { target_grade, current_grade } = req.body || {};
  db.prepare('UPDATE goals SET target_grade = ?, current_grade = ? WHERE id = ?').run(
    target_grade ?? goal.target_grade,
    current_grade ?? goal.current_grade,
    goal.id
  );
  res.json({ goal: db.prepare('SELECT * FROM goals WHERE id = ?').get(goal.id) });
});

app.delete('/api/goals/:id', auth, (req, res) => {
  const info = db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Goal not found' });
  res.json({ ok: true });
});

// ---------- dashboard summary ----------
app.get('/api/summary', auth, (req, res) => {
  const uid = req.user.id;
  const totalTasks = db.prepare('SELECT COUNT(*) c FROM tasks WHERE user_id = ?').get(uid).c;
  const doneTasks = db.prepare("SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND status = 'done'").get(uid).c;
  const todayDow = new Date().getDay();
  const todaysClasses = db.prepare('SELECT COUNT(*) c FROM schedule WHERE user_id = ? AND day_of_week = ?').get(uid, todayDow).c;
  const goals = db.prepare('SELECT * FROM goals WHERE user_id = ?').all(uid);
  const avgProgress = goals.length
    ? Math.round(goals.reduce((s, g) => s + (g.current_grade / (g.target_grade || 1)) * 100, 0) / goals.length)
    : 0;
  res.json({
    totalTasks,
    doneTasks,
    pendingTasks: totalTasks - doneTasks,
    todaysClasses,
    avgProgress: Math.min(avgProgress, 100),
    goalsCount: goals.length,
  });
});

// ---------- SPA fallbacks ----------
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n  EDUZONE running → http://localhost:${PORT}\n`);
});
