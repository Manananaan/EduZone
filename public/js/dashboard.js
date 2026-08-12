// dashboard.js — powers the EDUZONE dashboard (overview, tasks, schedule, goals)

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TYPE_COLORS = { class: '#126A80', study: '#169A8D', exam: '#C0392B', personal: '#20B89A' };
const SCHEDULE_START_HOUR = 6;
const SCHEDULE_END_HOUR = 23;

let state = { tasks: [], schedule: [], goals: [], summary: {}, taskFilter: 'all' };

// ---------- generic helpers ----------
function toast(message, type = 'success') {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = '/';
    throw new Error('Not authenticated');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
function fmtDate(d) {
  if (!d) return null;
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------- navigation ----------
const views = ['overview', 'tasks', 'schedule', 'goals'];
function goto(view) {
  views.forEach(v => {
    document.getElementById(`view-${v}`).hidden = v !== view;
  });
  document.querySelectorAll('.sb-link').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.view === view);
  });
  history.replaceState(null, '', `#${view}`);
}
document.querySelectorAll('.sb-link').forEach(btn => btn.addEventListener('click', () => goto(btn.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(btn => btn.addEventListener('click', () => goto(btn.dataset.goto)));
document.getElementById('quick-add-task').addEventListener('click', () => {
  goto('tasks');
  document.querySelector('#task-form input[name="title"]').focus();
});

// ---------- user / logout ----------
async function loadUser() {
  const { user } = await api('/api/me');
  document.getElementById('sb-user-name').textContent = user.name;
  document.getElementById('sb-user-email').textContent = user.email;
  document.getElementById('sb-avatar').textContent = user.name.trim()[0].toUpperCase();
  if (user.is_admin) document.getElementById('admin-nav-link').hidden = false;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greeting').textContent = `${greeting}, ${user.name.split(' ')[0]} 👋`;
  document.getElementById('today-str').textContent =
    `Here's your plan for ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}.`;
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  window.location.href = '/';
});

// ---------- overview ----------
async function loadSummary() {
  state.summary = await api('/api/summary');
  const s = state.summary;
  document.getElementById('stat-pending').textContent = s.pendingTasks;
  document.getElementById('stat-total-pill').textContent = `${s.totalTasks} total`;
  document.getElementById('stat-classes').textContent = s.todaysClasses;
  document.getElementById('stat-progress').textContent = `${s.avgProgress}%`;
  document.getElementById('stat-progress-bar').style.width = `${s.avgProgress}%`;
  document.getElementById('stat-done').textContent = s.doneTasks;
}

function renderTodayTimeline() {
  const dow = new Date().getDay();
  const items = state.schedule.filter(e => e.day_of_week === dow).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const el = document.getElementById('today-timeline');
  if (!items.length) {
    el.innerHTML = `<div class="timeline-empty">No classes or study blocks today. Enjoy the free time 🎉</div>`;
    return;
  }
  el.innerHTML = items.map(e => `
    <div class="timeline-item" style="border-left-color:${e.color || TYPE_COLORS[e.type]}">
      <span class="timeline-time">${fmtTime(e.start_time)}</span>
      <span class="timeline-title">${escapeHtml(e.title)}</span>
      <span class="pill pill-teal timeline-type">${e.type}</span>
    </div>
  `).join('');
}

function renderTodayTasks() {
  const pending = state.tasks.filter(t => t.status !== 'done').slice(0, 5);
  const el = document.getElementById('today-tasks');
  if (!pending.length) {
    el.innerHTML = `<div class="mini-empty">Nothing pending — you're all caught up ✅</div>`;
    return;
  }
  el.innerHTML = pending.map(t => `
    <div class="mini-task">
      <span class="pill ${priorityPillClass(t.priority)}">${t.priority}</span>
      <span class="mini-task-title">${escapeHtml(t.title)}</span>
      ${t.due_date ? `<span class="pill pill-navy">${fmtDate(t.due_date)}</span>` : ''}
    </div>
  `).join('');
}

function priorityPillClass(p) {
  return p === 'high' ? 'pill-red' : p === 'low' ? 'pill-green' : 'pill-amber';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- tasks ----------
async function loadTasks() {
  const { tasks } = await api('/api/tasks');
  state.tasks = tasks;
  renderTasks();
  renderTodayTasks();
}

function renderTasks() {
  const list = document.getElementById('task-list');
  const filtered = state.tasks.filter(t => {
    if (state.taskFilter === 'pending') return t.status !== 'done';
    if (state.taskFilter === 'done') return t.status === 'done';
    return true;
  });
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-emoji">📋</div>No tasks here yet. Add one above to get started.</div>`;
    return;
  }
  list.innerHTML = filtered.map(t => `
    <div class="task-row" data-id="${t.id}">
      <button class="task-check ${t.status === 'done' ? 'checked' : ''}" data-action="toggle">${t.status === 'done' ? '✓' : ''}</button>
      <div class="task-info">
        <div class="task-title ${t.status === 'done' ? 'done' : ''}">${escapeHtml(t.title)}</div>
        <div class="task-meta">
          <span class="pill ${priorityPillClass(t.priority)}">${t.priority}</span>
          <span>${escapeHtml(t.subject)}</span>
          ${t.due_date ? `<span>· Due ${fmtDate(t.due_date)}</span>` : ''}
        </div>
      </div>
      <button class="task-del" data-action="delete" title="Delete task">✕</button>
    </div>
  `).join('');
}

document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: fd.get('title'),
        subject: fd.get('subject') || 'General',
        due_date: fd.get('due_date') || null,
        priority: fd.get('priority'),
      }),
    });
    e.target.reset();
    e.target.subject.value = 'General';
    toast('Task added.');
    await Promise.all([loadTasks(), loadSummary()]);
  } catch (err) {
    toast(err.message, 'error');
  }
});

document.getElementById('task-list').addEventListener('click', async (e) => {
  const row = e.target.closest('.task-row');
  if (!row) return;
  const id = row.dataset.id;
  const action = e.target.dataset.action;
  if (action === 'toggle') {
    const task = state.tasks.find(t => String(t.id) === id);
    try {
      await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: task.status === 'done' ? 'pending' : 'done' }) });
      await Promise.all([loadTasks(), loadSummary()]);
    } catch (err) { toast(err.message, 'error'); }
  } else if (action === 'delete') {
    try {
      await api(`/api/tasks/${id}`, { method: 'DELETE' });
      toast('Task deleted.');
      await Promise.all([loadTasks(), loadSummary()]);
    } catch (err) { toast(err.message, 'error'); }
  }
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    state.taskFilter = chip.dataset.filter;
    renderTasks();
  });
});

// ---------- schedule ----------
async function loadSchedule() {
  const { schedule } = await api('/api/schedule');
  state.schedule = schedule;
  renderScheduleGrid();
  renderTodayTimeline();
}

function renderScheduleGrid() {
  const grid = document.getElementById('schedule-grid');
  const hours = [];
  for (let h = SCHEDULE_START_HOUR; h < SCHEDULE_END_HOUR; h++) hours.push(h);
  const todayDow = new Date().getDay();

  let html = `<div class="sg-corner"></div>`;
  DAY_NAMES.forEach((d, i) => {
    html += `<div class="sg-day-head ${i === todayDow ? 'is-today' : ''}">${d}</div>`;
  });

  hours.forEach(h => {
    html += `<div class="sg-hour">${h}:00</div>`;
    for (let d = 0; d < 7; d++) {
      html += `<div class="sg-cell" data-day="${d}" data-hour="${h}"></div>`;
    }
  });

  grid.innerHTML = html;

  // place events absolutely within their starting cell, spanning height by duration
  state.schedule.forEach(ev => {
    let hour = parseInt(ev.start_time.split(':')[0], 10);
    // clamp to the visible range so an event never silently disappears
    if (hour < SCHEDULE_START_HOUR) hour = SCHEDULE_START_HOUR;
    if (hour >= SCHEDULE_END_HOUR) hour = SCHEDULE_END_HOUR - 1;
    const cell = grid.querySelector(`.sg-cell[data-day="${ev.day_of_week}"][data-hour="${hour}"]`);
    if (!cell) return;
    const startMin = timeToMinutes(ev.start_time);
    const endMin = timeToMinutes(ev.end_time);
    const durationMin = Math.max(endMin - startMin, 20);
    const offsetWithinHour = startMin % 60;
    const cellHeight = 44;
    const pxPerMin = cellHeight / 60;

    const wrapper = document.createElement('div');
    wrapper.className = 'sg-event';
    wrapper.style.background = ev.color || TYPE_COLORS[ev.type] || '#126A80';
    wrapper.style.top = `${offsetWithinHour * pxPerMin + 2}px`;
    wrapper.style.height = `${durationMin * pxPerMin - 4}px`;
    wrapper.style.left = '2px';
    wrapper.style.right = '2px';
    wrapper.innerHTML = `${escapeHtml(ev.title)}<small>${fmtTime(ev.start_time)}–${fmtTime(ev.end_time)}</small><button class="ev-del" title="Remove" data-id="${ev.id}">✕</button>`;
    cell.style.position = 'relative';
    cell.appendChild(wrapper);
  });
}

document.getElementById('schedule-grid').addEventListener('click', async (e) => {
  if (e.target.classList.contains('ev-del')) {
    e.stopPropagation();
    const id = e.target.dataset.id;
    try {
      await api(`/api/schedule/${id}`, { method: 'DELETE' });
      toast('Event removed.');
      await loadSchedule();
    } catch (err) { toast(err.message, 'error'); }
  }
});

// event modal
const eventModal = document.getElementById('event-modal');
const eventForm = document.getElementById('event-form');
document.getElementById('add-event-btn').addEventListener('click', () => { eventModal.hidden = false; });
document.getElementById('event-cancel').addEventListener('click', () => { eventModal.hidden = true; eventForm.reset(); });
eventModal.addEventListener('click', (e) => { if (e.target === eventModal) { eventModal.hidden = true; } });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !eventModal.hidden) {
    eventModal.hidden = true;
    eventForm.reset();
  }
});

eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(eventForm);
  const type = fd.get('type');
  if (fd.get('end_time') <= fd.get('start_time')) {
    toast('End time must be after start time.', 'error');
    return;
  }
  try {
    await api('/api/schedule', {
      method: 'POST',
      body: JSON.stringify({
        title: fd.get('title'),
        day_of_week: Number(fd.get('day_of_week')),
        start_time: fd.get('start_time'),
        end_time: fd.get('end_time'),
        type,
        color: TYPE_COLORS[type],
      }),
    });
    eventModal.hidden = true;
    eventForm.reset();
    toast('Event added to your schedule.');
    await Promise.all([loadSchedule(), loadSummary()]);
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------- goals ----------
async function loadGoals() {
  const { goals } = await api('/api/goals');
  state.goals = goals;
  renderGoals();
}

function renderGoals() {
  const el = document.getElementById('goal-list');
  if (!state.goals.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-emoji">🎯</div>No goals yet. Add a subject and target grade above.</div>`;
    return;
  }
  el.innerHTML = state.goals.map(g => {
    const pct = Math.min(Math.round((g.current_grade / (g.target_grade || 1)) * 100), 100);
    return `
    <div class="card goal-card" data-id="${g.id}">
      <div class="goal-top">
        <span class="goal-subject">${escapeHtml(g.subject)}</span>
        <button class="goal-del" data-action="delete" title="Delete goal">✕</button>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="goal-numbers">
        <span>Current: ${g.current_grade}%</span>
        <span>Target: ${g.target_grade}%</span>
      </div>
      <input type="range" class="goal-slider" min="0" max="100" value="${g.current_grade}" data-action="update">
    </div>`;
  }).join('');
}

document.getElementById('goal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api('/api/goals', {
      method: 'POST',
      body: JSON.stringify({
        subject: fd.get('subject'),
        current_grade: Number(fd.get('current_grade')) || 0,
        target_grade: Number(fd.get('target_grade')) || 90,
      }),
    });
    e.target.reset();
    e.target.querySelector('[name="target_grade"]').value = 90;
    toast('Goal added.');
    await Promise.all([loadGoals(), loadSummary()]);
  } catch (err) { toast(err.message, 'error'); }
});

document.getElementById('goal-list').addEventListener('click', async (e) => {
  const card = e.target.closest('.goal-card');
  if (!card) return;
  if (e.target.dataset.action === 'delete') {
    try {
      await api(`/api/goals/${card.dataset.id}`, { method: 'DELETE' });
      toast('Goal removed.');
      await Promise.all([loadGoals(), loadSummary()]);
    } catch (err) { toast(err.message, 'error'); }
  }
});

document.getElementById('goal-list').addEventListener('change', async (e) => {
  if (e.target.dataset.action !== 'update') return;
  const card = e.target.closest('.goal-card');
  try {
    await api(`/api/goals/${card.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ current_grade: Number(e.target.value) }) });
    await Promise.all([loadGoals(), loadSummary()]);
  } catch (err) { toast(err.message, 'error'); }
});

// ---------- boot ----------
(async function init() {
  try {
    await loadUser();
    await Promise.all([loadTasks(), loadSchedule(), loadGoals()]);
    await loadSummary();
    const hash = window.location.hash.replace('#', '');
    if (views.includes(hash)) goto(hash);
  } catch (err) {
    console.error(err);
  }
})();
