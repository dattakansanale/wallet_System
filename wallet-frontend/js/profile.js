const API_URL = 'http://localhost:5000/api';
const token = localStorage.getItem('walletToken');

if (!token) window.location.href = 'login.html';

const form = document.getElementById('profile-form');
const fNameInput = document.getElementById('fName');
const lNameInput = document.getElementById('lName');
const phoneInput = document.getElementById('phone');
const emailInput = document.getElementById('email');
const addressInput = document.getElementById('address');
const cancelBtn = document.getElementById('cancel-btn');
const editBtn = document.getElementById('edit-btn');
const saveBtn = document.getElementById('save-btn');
const oldPinInput = document.getElementById('oldPin');
const newPinInput = document.getElementById('newPin');
const confirmNewPinInput = document.getElementById('confirmNewPin');
const pinBlock = document.getElementById('pin-block');

let currentUser = null;

window.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  form.addEventListener('submit', saveProfile);
  cancelBtn.addEventListener('click', onCancel);
  editBtn.addEventListener('click', enableEdit);
  // Save button already wired via form submit
});

async function loadProfile() {
  try {
    const res = await fetch(`${API_URL}/auth/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.status === 401) { localStorage.removeItem('walletToken'); window.location.href = 'login.html'; return; }
    if (!res.ok) throw new Error('Failed to load profile');

    const data = await res.json();
    currentUser = data.user;
    fNameInput.value = currentUser.F_Name || '';
    lNameInput.value = currentUser.L_Name || '';
    phoneInput.value = currentUser.Phn_No || '';
    emailInput.value = currentUser.Email || '';
    addressInput.value = currentUser.Address || '';

    // Keep a copy so we can revert on cancel
    originalValues = {
      F_Name: fNameInput.value,
      L_Name: lNameInput.value,
      Phn_No: phoneInput.value,
      Email: emailInput.value,
      Address: addressInput.value
    };
  } catch (err) {
    showAlert(err.message || 'Error loading profile', 'danger');
  }
}

async function saveProfile(e) {
  e.preventDefault();

  const payload = {
    fName: fNameInput.value.trim(),
    lName: lNameInput.value.trim(),
    phone: phoneInput.value.trim(),
    email: emailInput.value.trim(),
    address: addressInput.value.trim(),
  };

  // Handle PIN change if user entered a new PIN
  const newPin = newPinInput ? newPinInput.value.trim() : '';
  const oldPin = oldPinInput ? oldPinInput.value.trim() : '';
  const confirmPin = confirmNewPinInput ? confirmNewPinInput.value.trim() : '';
  if (newPin) {
    // client-side validation
    if (!/^[0-9]{6}$/.test(newPin)) { showAlert('New PIN must be exactly 6 digits', 'danger'); return; }
    if (newPin !== confirmPin) { showAlert('New PIN and confirmation do not match', 'danger'); return; }
    if (!oldPin) { showAlert('Current PIN is required to change PIN', 'danger'); return; }
    payload.newPin = newPin;
    payload.oldPin = oldPin;
  }

  // Basic validation
  if (!payload.fName || !payload.phone || !payload.email) {
    showAlert('First name, phone and email are required', 'danger');
    return;
  }

  try {
    showAlert('Saving...', 'info');
    const res = await fetch(`${API_URL}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { message: text }; }

    if (!res.ok) throw new Error(data.message || 'Failed to save profile');

    showAlert('Profile updated', 'success');
    // Ask other pages to refresh dashboard
    localStorage.setItem('walletRefresh', '1');
    // After save, disable editing and update originalValues
    originalValues = { F_Name: payload.fName, L_Name: payload.lName, Phn_No: payload.phone, Email: payload.email, Address: payload.address };
    disableEdit();
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
  } catch (err) {
    showAlert(err.message || 'Error saving profile', 'danger');
  }
}

let originalValues = {};

function enableEdit() {
  fNameInput.disabled = false;
  lNameInput.disabled = false;
  phoneInput.disabled = false;
  emailInput.disabled = false;
  addressInput.disabled = false;
  // show PIN fields
  if (pinBlock) pinBlock.style.display = '';

  editBtn.style.display = 'none';
  saveBtn.style.display = '';
  cancelBtn.style.display = '';
}

function disableEdit() {
  fNameInput.disabled = true;
  lNameInput.disabled = true;
  phoneInput.disabled = true;
  emailInput.disabled = true;
  addressInput.disabled = true;
  // hide PIN inputs and clear
  if (pinBlock) pinBlock.style.display = 'none';
  if (oldPinInput) oldPinInput.value = '';
  if (newPinInput) newPinInput.value = '';
  if (confirmNewPinInput) confirmNewPinInput.value = '';

  editBtn.style.display = '';
  saveBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
}

function onCancel() {
  // revert values
  if (originalValues) {
    fNameInput.value = originalValues.F_Name || '';
    lNameInput.value = originalValues.L_Name || '';
    phoneInput.value = originalValues.Phn_No || '';
    emailInput.value = originalValues.Email || '';
    addressInput.value = originalValues.Address || '';
  }
  if (oldPinInput) oldPinInput.value = '';
  if (newPinInput) newPinInput.value = '';
  if (confirmNewPinInput) confirmNewPinInput.value = '';
  disableEdit();
}

let alertTimeout;
function showAlert(message, type) {
  const alert = document.getElementById('main-alert');
  if (alert) {
    if (alertTimeout) clearTimeout(alertTimeout);
    alert.textContent = message;
    alert.className = `alert alert-${type}`;
    alert.classList.remove('d-none');
    alertTimeout = setTimeout(() => { alert.classList.add('d-none'); }, 3000);
  }
}
