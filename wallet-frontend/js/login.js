// js/login.js
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginAlert = document.getElementById('auth-alert'); // Uses new alert ID
  const API_URL = 'http://localhost:5000/api'; // Your backend URL

  if (!loginForm) return; // Make sure script doesn't run on other pages

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginAlert.classList.add('d-none');

    const loginIdentifier = document.getElementById('loginIdentifier').value;
    const password = document.getElementById('password').value;

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginIdentifier, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Login Success!
      // Store the token and redirect to the dashboard
      localStorage.setItem('walletToken', data.token);
      window.location.href = 'index.html'; // Redirect to main app page

    } catch (error) {
      loginAlert.textContent = error.message;
      loginAlert.classList.remove('d-none');
    }
  });
});