/**
 * NitrklShare — Auth Page Logic
 * Handles login and registration forms
 */

(function () {
  // If already logged in, redirect to dashboard
  if (API.isLoggedIn()) {
    window.location.href = '/dashboard.html';
    return;
  }

  // --- LOGIN ---
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const btn = document.getElementById('login-btn');
      const alert = document.getElementById('login-alert');

      // Reset errors
      clearErrors();
      alert.classList.remove('visible');

      // Validate
      let hasError = false;
      if (!email) { showFieldError('email', 'Email is required'); hasError = true; }
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldError('email', 'Enter a valid email'); hasError = true; }
      if (!password) { showFieldError('password', 'Password is required'); hasError = true; }

      if (hasError) return;

      btn.classList.add('loading');
      try {
        await API.login(email, password);
        window.location.href = '/dashboard.html';
      } catch (err) {
        alert.textContent = err.message;
        alert.classList.add('visible');
      } finally {
        btn.classList.remove('loading');
      }
    });
  }

  // --- REGISTER ---
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const display_name = document.getElementById('display_name').value.trim();
      const username = document.getElementById('username').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm_password').value;
      const btn = document.getElementById('register-btn');
      const alert = document.getElementById('register-alert');

      clearErrors();
      alert.classList.remove('visible');

      let hasError = false;
      if (!display_name) { showFieldError('display_name', 'Display name is required'); hasError = true; }
      if (!username) { showFieldError('username', 'Username is required'); hasError = true; }
      else if (username.length < 3) { showFieldError('username', 'Username must be at least 3 characters'); hasError = true; }
      else if (!/^[a-zA-Z0-9_]+$/.test(username)) { showFieldError('username', 'Only letters, numbers, and underscores'); hasError = true; }
      if (!email) { showFieldError('email', 'Email is required'); hasError = true; }
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldError('email', 'Enter a valid email'); hasError = true; }
      if (!password) { showFieldError('password', 'Password is required'); hasError = true; }
      else if (password.length < 6) { showFieldError('password', 'Password must be at least 6 characters'); hasError = true; }
      if (password !== confirm) { showFieldError('confirm_password', 'Passwords do not match'); hasError = true; }

      if (hasError) return;

      btn.classList.add('loading');
      try {
        await API.register(username, email, password, display_name);
        window.location.href = '/dashboard.html';
      } catch (err) {
        alert.textContent = err.message;
        alert.classList.add('visible');
      } finally {
        btn.classList.remove('loading');
      }
    });
  }

  function showFieldError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}-error`);
    const inputEl = document.getElementById(fieldId);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
    if (inputEl) inputEl.classList.add('error');
  }

  function clearErrors() {
    document.querySelectorAll('.form-error').forEach(el => {
      el.textContent = '';
      el.classList.remove('visible');
    });
    document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
  }
})();
