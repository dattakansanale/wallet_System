// js/pay-merchant.js
const API_URL = 'http://localhost:5000/api';
const token = localStorage.getItem('walletToken');

// Redirect to login if no token
if (!token) {
  window.location.href = 'login.html'; 
}

// Global state for this page
let allMerchants = [];
let selectedMerchantId = null;

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
    receiverIdInput: document.getElementById('modal-receiver-id'),
    amountInput: document.getElementById('amount'),
    pinInput: document.getElementById('wallet-pin'),
    descriptionInput: document.getElementById('description')
  };

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
    // EDITED: Storing merchants, not users
    allMerchants = data.merchants || [];
    
    renderDataList();

  } catch (error) {
    showAlert(error.message, 'danger');
    renderDataList(); // Render empty list
  }
}

function renderDataList(searchTerm = '') {
  dom.dataList.innerHTML = ''; // Clear list
  searchTerm = searchTerm.toLowerCase();
  
  // EDITED: Filtering merchants
  const filteredMerchants = allMerchants.filter(m => 
    m.Name.toLowerCase().includes(searchTerm)
  );

  if (filteredMerchants.length === 0) {
    dom.dataList.innerHTML = `<div class="text-center text-muted" style="padding: 2rem;">No merchants found.</div>`;
    return;
  }

  // EDITED: Creating merchant items
  filteredMerchants.forEach(merchant => {
    const item = document.createElement('div');
    item.className = 'contact-item';
    item.dataset.id = merchant.Merchant_ID;
    
    // Highlight if selected
    if(merchant.Merchant_ID === selectedMerchantId) {
      item.classList.add('selected');
    }

    // EDITED: Using merchant avatar and info
    item.innerHTML = `
      <div class="avatar merchant"><i class="fa-solid fa-store"></i></div>
      <div class="contact-info">
        <h6>${merchant.Name}</h6>
        <p>${merchant.Business_Type || 'Merchant'}</p>
      </div>
    `;
    // Add click listener to select the merchant
    item.addEventListener('click', () => handleMerchantSelect(merchant));
    dom.dataList.appendChild(item);
  });
}

// EDITED: Renamed to handleMerchantSelect
function handleMerchantSelect(merchant) {
  // Set the selected merchant ID
  selectedMerchantId = merchant.Merchant_ID;
  
  // Re-render the list to show the selection
  renderDataList(dom.searchBar.value);

  // Show the payment form
  dom.paymentPlaceholder.classList.add('d-none');
  dom.paymentFormContainer.classList.remove('d-none');

  // Populate the form
  // EDITED: No initials, just name
  dom.receiverName.textContent = merchant.Name;
  dom.receiverIdInput.value = merchant.Merchant_ID;
}

async function handlePayment(e) {
  e.preventDefault();

  const paymentData = {
    // EDITED: Hardcoded to MERCHANT
    receiverType: 'MERCHANT',
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