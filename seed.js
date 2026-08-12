// seed.js — creates a demo account with sample tasks, schedule and goals.
// Run once with: node seed.js

const bcrypt = require('bcryptjs');
const db = require('./database');

const email = 'demo@eduzone.app';
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

let userId;
if (existing) {
  userId = existing.id;
  console.log('Demo user already exists, refreshing sample data…');
  db.prepare('DELETE FROM tasks WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM schedule WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM goals WHERE user_id = ?').run(userId);
  db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(userId);
} else {
  const hash = bcrypt.hashSync('demo123', 10);
  const info = db.prepare(
    'INSERT INTO users (name, email, password_hash, avatar_color, is_admin, last_login) VALUES (?, ?, ?, ?, 1, datetime(\'now\'))'
  ).run('Demo Student', email, hash, '#169A8D');
  userId = info.lastInsertRowid;
  console.log('Created demo user (admin):', email, '/ demo123');
}

// a second, non-admin account so the admin table has more than one row to show
const friendEmail = 'friend@eduzone.app';
const friendExisting = db.prepare('SELECT id FROM users WHERE email = ?').get(friendEmail);
if (!friendExisting) {
  const friendHash = bcrypt.hashSync('friend123', 10);
  db.prepare(
    'INSERT INTO users (name, email, password_hash, avatar_color, last_login) VALUES (?, ?, ?, ?, datetime(\'now\', \'-1 day\'))'
  ).run('Sara Ali', friendEmail, friendHash, '#20B89A');
  console.log('Created sample non-admin user:', friendEmail, '/ friend123');
}

const today = new Date();
function isoDaysFromNow(n) {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const insertTask = db.prepare('INSERT INTO tasks (user_id, title, subject, due_date, priority, status) VALUES (?, ?, ?, ?, ?, ?)');
insertTask.run(userId, 'Math assignment — Chapter 6', 'Mathematics', isoDaysFromNow(0), 'high', 'pending');
insertTask.run(userId, 'Physics revision', 'Physics', isoDaysFromNow(1), 'high', 'pending');
insertTask.run(userId, 'C++ practice problems', 'Computer Science', isoDaysFromNow(2), 'medium', 'pending');
insertTask.run(userId, 'Read history chapter 4', 'History', isoDaysFromNow(4), 'low', 'pending');
insertTask.run(userId, 'Submit lab report', 'Chemistry', isoDaysFromNow(-1), 'medium', 'done');

const insertSchedule = db.prepare(
  'INSERT INTO schedule (user_id, day_of_week, start_time, end_time, title, type, color) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const todayDow = today.getDay();
insertSchedule.run(userId, todayDow, '09:00', '10:30', 'Math class', 'class', '#126A80');
insertSchedule.run(userId, todayDow, '11:00', '12:00', 'Physics class', 'class', '#126A80');
insertSchedule.run(userId, todayDow, '14:00', '15:30', 'Study block', 'study', '#169A8D');
insertSchedule.run(userId, (todayDow + 1) % 7, '10:00', '11:30', 'Chemistry class', 'class', '#126A80');
insertSchedule.run(userId, (todayDow + 1) % 7, '16:00', '17:00', 'C++ practice', 'study', '#169A8D');
insertSchedule.run(userId, (todayDow + 2) % 7, '09:00', '11:00', 'Math exam', 'exam', '#C0392B');
insertSchedule.run(userId, (todayDow + 3) % 7, '13:00', '14:00', 'Gym', 'personal', '#20B89A');

const insertGoal = db.prepare('INSERT INTO goals (user_id, subject, target_grade, current_grade) VALUES (?, ?, ?, ?)');
insertGoal.run(userId, 'Mathematics', 90, 82);
insertGoal.run(userId, 'Physics', 85, 74);
insertGoal.run(userId, 'Computer Science', 95, 91);

console.log('Sample tasks, schedule and goals added for the demo account.');
