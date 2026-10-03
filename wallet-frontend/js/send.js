// js/send.js
const API_URL = 'http://localhost:5000/api';
const token = localStorage.getItem('walletToken');

// Redirect to login if no token
if (!token) {
  window.location.href = 'login.html'; 
}

// Global state for this page
let allUsers = [];
let selectedUserId = null;

// DOM Elements
let dom = {};

document.addEventListener('DOMContentLoaded', () => {
  // Cache all DOM elements
  dom = {
    searchBar: document.getElementById('search-bar'),
    dataList: document.getElementById('data-list'),
    paymentPanel: document.querySelector('.payment-panel'),
    paymentFormContainer: document.getElementById('payment-form-container'),
    paymentPlaceholder: document.getElementById('payment-placeholder'),
    paymentForm: document.getElementById('payment-form'),
  receiverInitials: document.getElementById('modal-receiver-initials'),
  receiverName: document.getElementById('modal-receiver-name'),
  receiverIdSpan: document.getElementById('receiver-id'),
    receiverIdInput: document.getElementById('modal-receiver-id'),
    amountInput: document.getElementById('amount'),
    pinInput: document.getElementById('wallet-pin'),
    descriptionInput: document.getElementById('description')
  };

  // Load current user's dashboard info (kept for balance/name updates elsewhere)
  loadDashboardData();

  // Load contacts for selection
  loadContactData();
  
  // Setup event handlers
  dom.searchBar.addEventListener('input', (e) => renderDataList(e.target.value));
  dom.paymentForm.addEventListener('submit', handlePayment);
});


async function loadContactData() {
  try {
    const res = await fetch(`${API_URL}/payments/contacts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
      localStorage.removeItem('walletToken');
      window.location.href = 'login.html';
      return;
    }
    if (!res.ok) throw new Error('Failed to load contacts');

    const data = await res.json();
    allUsers = data.users || [];
    
    renderDataList();

  } catch (error) {
    showAlert(error.message, 'danger');
    renderDataList(); // Render empty list
  }
}

function renderDataList(searchTerm = '') {
  dom.dataList.innerHTML = ''; // Clear list
  searchTerm = searchTerm.toLowerCase();
  
  const filteredUsers = allUsers.filter(u => 
    u.F_Name.toLowerCase().includes(searchTerm) || 
    (u.L_Name && u.L_Name.toLowerCase().includes(searchTerm)) ||
    u.Phn_No.includes(searchTerm)
  );

  if (filteredUsers.length === 0) {
    dom.dataList.innerHTML = `<div class="text-center text-muted" style="padding: 2rem;">No users found.</div>`;
    return;
  }

  filteredUsers.forEach(user => {
    const item = document.createElement('div');
    item.className = 'contact-item';
    item.dataset.id = user.User_ID;
    
    // Highlight if selected
    if(user.User_ID === selectedUserId) {
      item.classList.add('selected');
    }

    item.innerHTML = `
      <div class="avatar">${user.F_Name[0].toUpperCase()}</div>
      <div class="contact-info">
        <h6>${user.F_Name} ${user.L_Name}</h6>
        <p>${user.Phn_No}</p>
      </div>
    `;
    // Add click listener to select the user
    item.addEventListener('click', () => handleUserSelect(user));
    dom.dataList.appendChild(item);
  });
}

function handleUserSelect(user) {
  // Set the selected user ID
  selectedUserId = user.User_ID;
  
  // Re-render the list to show the selection
  renderDataList(dom.searchBar.value);

  // Show the payment form
  dom.paymentPlaceholder.classList.add('d-none');
  dom.paymentFormContainer.classList.remove('d-none');

  // Populate the form
  dom.receiverInitials.textContent = user.F_Name[0].toUpperCase();
  dom.receiverName.textContent = `${user.F_Name} ${user.L_Name}`;
  dom.receiverIdInput.value = user.User_ID;
  // Update the visible receiver id label
  if (dom.receiverIdSpan) dom.receiverIdSpan.textContent = `#${user.User_ID}`;
}

async function handlePayment(e) {
  e.preventDefault();

  const paymentData = {
    receiverType: 'USER',
    receiverId: parseInt(dom.receiverIdInput.value),
    amount: parseFloat(dom.amountInput.value),
    pin: dom.pinInput.value,
    description: dom.descriptionInput.value || 'Payment',
    txnHash: 'txn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
  };

  if (!paymentData.receiverId || !paymentData.amount || paymentData.amount <= 0 || !paymentData.pin) {
    showAlert('Please fill all fields correctly.', 'danger');
    return;
  }

  try {
    showAlert('Processing payment...', 'info');

    const res = await fetch(`${API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(paymentData)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Payment failed');

    showAlert('Payment successful! Redirecting...', 'success');
    
    // Redirect back to dashboard after 2 seconds
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);

  } catch (error) {
    showAlert(error.message, 'danger');
  }
}

// --- Global Alert Function ---
let alertTimeout;
function showAlert(message, type) {
  const alert = document.getElementById('main-alert');
  if (alert) {
    if (alertTimeout) clearTimeout(alertTimeout);
    
    alert.textContent = message;
    alert.className = `alert alert-${type}`;
    alert.classList.remove('d-none');

    alertTimeout = setTimeout(() => {
      alert.classList.add('d-none');
    }, 3000);
  }
}

// Load dashboard to obtain current user's ID and balance info
async function loadDashboardData() {
  try {
    const res = await fetch(`${API_URL}/payments/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
      localStorage.removeItem('walletToken');
      window.location.href = 'login.html';
      return;
    }
    if (!res.ok) throw new Error('Failed to load user info');

    const data = await res.json();
    // We don't auto-fill the receiver id here. The receiver id is shown when
    // the user selects a contact in the list (see handleUserSelect).
  } catch (err) {
    // Non-fatal: show placeholder
    if (dom.payerIdSpan) dom.payerIdSpan.textContent = '#?';
  }
}