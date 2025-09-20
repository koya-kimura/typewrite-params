// loginUI.js
// Controls the login overlay and integrates with Auth from auth.js

function qs(sel) { return document.querySelector(sel); }
function setStatus(msg, isError = false) {
  const el = qs('#login-status');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = isError ? '#ff6b6b' : '#aaa';
}

function hideOverlay() {
  const overlay = qs('#login-overlay');
  if (overlay) overlay.style.display = 'none';
}

function showOverlay() {
  const overlay = qs('#login-overlay');
  if (overlay) overlay.style.display = 'flex';
}

async function attemptAutoLogin() {
  try {
    const session = window.Auth?.getSession?.();
    if (session && session.token && session.csrf) {
      hideOverlay();
    } else {
      showOverlay();
    }
  } catch {
    showOverlay();
  }
}

function wireForm() {
  const form = qs('#login-form');
  const idInput = qs('#login-id');
  const pwInput = qs('#login-password');
  const btn = qs('#login-submit');

  if (!form || !idInput || !pwInput || !btn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = idInput.value.trim();
    const password = pwInput.value;
    if (!id || !password) {
      setStatus('ID と パスワードを入力してください。', true);
      return;
    }

    setStatus('Signing in…');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const session = await window.Auth.login(id, password);
      setStatus('Signed in');
      hideOverlay();
      // Optionally: dispatch event for other parts of app
      window.dispatchEvent(new CustomEvent('auth:login', { detail: session }));
    } catch (err) {
      setStatus(err?.message || 'Login failed', true);
    } finally {
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });
}

// Initialize when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // attemptAutoLogin();
    wireForm();
  });
} else {
//   attemptAutoLogin();
  wireForm();
}
