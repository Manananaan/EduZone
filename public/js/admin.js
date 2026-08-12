// admin.js — powers the EDUZONE admin monitoring page.

function toast(message, type = 'success') {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (res.status === 401) { window.location.href = '/'; throw new Error('Not authenticated'); }
  if (res.status === 403) { window.location.href = '/dashboard'; throw new Error('Admin access required'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(iso) {
  if (!iso) return 'Never';
  const then = new Date(iso.replace(' ', 'T') + 'Z');
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

let allUsers = [];
let currentUserId = null;

async function loadUser() {
  const { user } = await api('/api/me');
  currentUserId = user.id;
  document.getElementById('sb-user-name').textContent = user.name;
  document.getElementById('sb-user-email').textContent = user.email;
  document.getElementById('sb-avatar').textContent = user.name.trim()[0].toUpperCase();
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  window.location.href = '/';
});

async function loadOverview() {
  const o = await api('/api/admin/overview');
  document.getElementById('a-total-users').textContent = o.totalUsers;
  document.getElementById('a-active-today').textContent = o.activeToday;
  document.getElementById('a-new-week').textContent = o.newThisWeek;
  document.getElementById('a-total-tasks').textContent = o.totalTasks;
  document.getElementById('a-total-events').textContent = o.totalEvents;
  document.getElementById('a-total-goals').textContent = o.totalGoals;
  renderSignupChart(o.signupsByDay);
}

function renderSignupChart(data) {
  // build a full 14-day range so days with 0 signups still show a bar
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const map = Object.fromEntries(data.map(d => [d.day, d.count]));
  const max = Math.max(...days.map(d => map[d] || 0), 1);

  const el = document.getElementById('signup-chart');
  el.innerHTML = days.map(day => {
    const count = map[day] || 0;
    const height = Math.max((count / max) * 100, count > 0 ? 8 : 2);
    const label = new Date(day + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).replace(' ', '');
    return `
      <div class="sc-bar-wrap" title="${label}: ${count} signup${count === 1 ? '' : 's'}">
        <span class="sc-count">${count > 0 ? count : ''}</span>
        <div class="sc-bar" style="height:${height}%"></div>
        <span class="sc-label">${label}</span>
      </div>`;
  }).join('');
}

async function loadUsers() {
  const { users } = await api('/api/admin/users');
  allUsers = users;
  renderUsers(allUsers);
}

function renderUsers(users) {
  const tbody = document.getElementById('user-table-body');
  if (!users.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No users found.</td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr data-id="${u.id}">
      <td>
        <div class="au-cell">
          <span class="au-avatar" style="background:${u.avatar_color || '#169A8D'}">${escapeHtml(u.name.trim()[0].toUpperCase())}</span>
          <div>
            <div class="au-name">${escapeHtml(u.name)}${u.id === currentUserId ? ' (you)' : ''}</div>
            <div class="au-email">${escapeHtml(u.email)}</div>
          </div>
        </div>
      </td>
      <td>${fmtDate(u.created_at)}</td>
      <td>${timeAgo(u.last_login)}</td>
      <td>${u.task_done_count}/${u.task_count}</td>
      <td>${u.event_count}</td>
      <td>${u.goal_count}</td>
      <td>
        <button class="role-toggle ${u.is_admin ? 'is-admin' : ''}" data-action="toggle-admin" ${u.id === currentUserId ? 'disabled title="You can\'t change your own role"' : ''}>
          ${u.is_admin ? 'Admin' : 'Student'}
        </button>
      </td>
      <td>
        <button class="row-delete" data-action="delete" ${u.id === currentUserId ? 'disabled title="You can\'t delete your own account"' : ''} title="Delete user">✕</button>
      </td>
    </tr>
  `).join('');
}

document.getElementById('user-search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = allUsers.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  renderUsers(filtered);
});

document.getElementById('user-table-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn || btn.disabled) return;
  const row = e.target.closest('tr');
  const id = row.dataset.id;

  if (btn.dataset.action === 'toggle-admin') {
    try {
      await api(`/api/admin/users/${id}/admin`, { method: 'PATCH' });
      toast('Role updated.');
      await loadUsers();
    } catch (err) { toast(err.message, 'error'); }
  } else if (btn.dataset.action === 'delete') {
    const user = allUsers.find(u => String(u.id) === id);
    if (!confirm(`Delete ${user.name}'s account? This removes all their tasks, schedule events, and goals permanently.`)) return;
    try {
      await api(`/api/admin/users/${id}`, { method: 'DELETE' });
      toast('User deleted.');
      await Promise.all([loadUsers(), loadOverview()]);
    } catch (err) { toast(err.message, 'error'); }
  }
});

document.getElementById('refresh-btn').addEventListener('click', async () => {
  try {
    await Promise.all([loadOverview(), loadUsers()]);
    toast('Refreshed.');
  } catch (err) { toast(err.message, 'error'); }
});

(async function init() {
  try {
    await loadUser();
    await Promise.all([loadOverview(), loadUsers()]);
  } catch (err) {
    console.error(err);
  }
})();
