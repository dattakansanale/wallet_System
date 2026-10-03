// js/register.js
document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('register-form');
  const registerAlert = document.getElementById('auth-alert'); // Uses new alert ID
  const API_URL = 'http://localhost:5000/api';

  if (!registerForm) return; // Make sure script doesn't run on other pages

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerAlert.classList.add('d-none');

    const isMerchant = document.getElementById('isMerchant') && document.getElementById('isMerchant').checked;

    const formData = {
      fName: document.getElementById('fName').value.trim(),
      lName: document.getElementById('lName').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
      pin: document.getElementById('pin').value
    };

    if (isMerchant) {
      formData.isMerchant = true;
      formData.businessName = document.getElementById('businessName').value.trim();
      formData.businessType = document.getElementById('businessType').value.trim();
      formData.businessAddress = document.getElementById('businessAddress').value.trim();
    }

    // Client-side validation
    if (formData.phone.length !== 10 || !/^\d{10}$/.test(formData.phone)) {
      showAlert('Phone number must be exactly 10 digits', 'danger');
      return;
    }

    if (formData.pin.length !== 6 || !/^\d{6}$/.test(formData.pin)) {
      showAlert('PIN must be exactly 6 digits', 'danger');
      return;
    }

    if (formData.password.length < 6) {
      showAlert('Password must be at least 6 characters', 'danger');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Success!
      showAlert('Registration successful! Redirecting...', 'success');

      // Store token and redirect
      localStorage.setItem('walletToken', data.token);
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);

    } catch (error) {
      showAlert(error.message, 'danger');
    }
  });

  function showAlert(message, type) {
    registerAlert.textContent = message;
    // Set class based on type
    if (type === 'danger') {
      registerAlert.style.backgroundColor = 'var(--danger-bg)';
      registerAlert.style.color = 'var(--danger)';
    } else {
      registerAlert.style.backgroundColor = 'var(--success-bg)';
      registerAlert.style.color = 'var(--success-text)';
    }
    registerAlert.classList.remove('d-none');
  }
});

// Toggle merchant fields visibility
document.addEventListener('DOMContentLoaded', () => {
  const chk = document.getElementById('isMerchant');
  const mf = document.getElementById('merchant-fields');
  if (!chk || !mf) return;
  chk.addEventListener('change', () => {
    mf.style.display = chk.checked ? 'block' : 'none';
  });
});