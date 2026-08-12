// set-admin.js — grants admin access to an existing account by email.
// Usage: node set-admin.js you@example.com

const db = require('./database');

const email = process.argv[2];
if (!email) {
  console.log('Usage: node set-admin.js you@example.com');
  process.exit(1);
}

const user = db.prepare('SELECT id, name, is_admin FROM users WHERE email = ?').get(email.toLowerCase());
if (!user) {
  console.log(`No account found for ${email}. Register that account first, then run this again.`);
  process.exit(1);
}

if (user.is_admin) {
  console.log(`${user.name} (${email}) is already an admin.`);
} else {
  db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
  console.log(`${user.name} (${email}) is now an admin. Log out and back in, then visit /admin.`);
}
