// auth.js — handles tab switching, validation, and login/register requests.

const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

function showTab(which) {
  const isLogin = which === 'login';
  tabLogin.classList.toggle('is-active', isLogin);
  tabRegister.classList.toggle('is-active', !isLogin);
  tabLogin.setAttribute('aria-selected', isLogin);
  tabRegister.setAttribute('aria-selected', !isLogin);
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
  loginForm.classList.remove('auth-form');
  registerForm.classList.remove('auth-form');
  void loginForm.offsetWidth; // restart animation
  loginForm.classList.add('auth-form');
  registerForm.classList.add('auth-form');
}

tabLogin.addEventListener('click', () => showTab('login'));
tabRegister.addEventListener('click', () => showTab('register'));
document.querySelectorAll('[data-switch]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    showTab(link.dataset.switch);
  });
});

// password visibility toggles
document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? '🙈' : '👁';
  });
});

// password strength meter on register
const regPassword = registerForm.querySelector('input[name="password"]');
const strengthEl = registerForm.querySelector('.pw-strength');
regPassword.addEventListener('input', () => {
  const v = regPassword.value;
  let score = 0;
  if (v.length >= 6) score++;
  if (v.length >= 10 && /[0-9]/.test(v) && /[a-zA-Z]/.test(v)) score++;
  if (v.length >= 10 && /[^a-zA-Z0-9]/.test(v)) score++;
  strengthEl.classList.remove('weak', 'medium', 'strong');
  if (v.length === 0) return;
  strengthEl.classList.add(score <= 1 ? 'weak' : score === 2 ? 'medium' : 'strong');
});

// toast helper
function toast(message, type = 'success') {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function setLoading(form, loading) {
  const btn = form.querySelector('.auth-submit');
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled = loading;
  spinner.hidden = !loading;
  btn.style.opacity = loading ? 0.85 : 1;
}

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}
function hideError(el) {
  el.hidden = true;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  hideError(errEl);
  const fd = new FormData(loginForm);
  setLoading(loginForm, true);
  try {
    await apiPost('/api/login', { email: fd.get('email'), password: fd.get('password') });
    toast('Welcome back! Redirecting…');
    setTimeout(() => (window.location.href = '/dashboard'), 500);
  } catch (err) {
    showError(errEl, err.message);
    setLoading(loginForm, false);
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  hideError(errEl);
  const fd = new FormData(registerForm);
  setLoading(registerForm, true);
  try {
    await apiPost('/api/register', {
      name: fd.get('name'),
      email: fd.get('email'),
      password: fd.get('password'),
    });
    toast('Account created! Setting up your dashboard…');
    setTimeout(() => (window.location.href = '/dashboard'), 500);
  } catch (err) {
    showError(errEl, err.message);
    setLoading(registerForm, false);
  }
});

// if already logged in, skip straight to dashboard
(async () => {
  try {
    const res = await fetch('/api/me');
    if (res.ok) window.location.href = '/dashboard';
  } catch (_) { /* not logged in — stay on this page */ }
})();
