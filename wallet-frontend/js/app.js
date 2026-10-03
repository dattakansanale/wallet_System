// js/app.js
const API_URL = 'http://localhost:5000/api';
const token = localStorage.getItem('walletToken');

// Redirect to login if no token
if (!token) {
  window.location.href = 'login.html'; 
}

// Global state
let allData = {
  dashboard: null,
  users: [],
};

// DOM Elements
let dom = {};

document.addEventListener('DOMContentLoaded', () => {
  const mainApp = document.querySelector('.app-container');
  if (!mainApp) return; 

  // Cache all DOM elements
  dom = {
    userName: document.getElementById('user-name'),
    walletBalance: document.getElementById('wallet-balance'),
    quickSendList: document.getElementById('quick-send-list'),
    topAvatar: document.getElementById('top-avatar'),
    profileBtn: document.getElementById('profile-btn'),
    
    // Sidebar Actions
    actionSendUser: document.getElementById('action-send-user'),
    actionPayMerchant: document.getElementById('action-pay-merchant'),
    actionHistory: document.getElementById('action-history'),
  actionReports: document.getElementById('action-reports'),
    actionRewards: document.getElementById('action-rewards'),
  actionNotifications: document.getElementById('action-notifications'),
    actionRefund: document.getElementById('action-refund'),
  actionManageRefunds: document.getElementById('action-manage-refunds'),
    logoutBtn: document.getElementById('logout-btn'),

    // EDITED: Replaced utility buttons with invite button
    inviteBtn: document.getElementById('invite-btn'),
  };

  // Clicking the user name opens the profile page
  if (dom.userName) {
    dom.userName.style.cursor = 'pointer';
    dom.userName.title = 'View / edit profile';
    dom.userName.addEventListener('click', () => { window.location.href = 'profile.html'; });
  }

  // Load sidebar data
  loadDashboardData();
  // Load contacts for the widget
  loadContactData();
  // If another page requested a dashboard refresh, reload data once
  if (localStorage.getItem('walletRefresh') === '1') {
    localStorage.removeItem('walletRefresh');
    loadDashboardData();
    loadContactData();
  }

  // Listen for changes from other tabs/pages (e.g., rewards redeemed)
  window.addEventListener('storage', (e) => {
    if (!e.key) return;
    if (e.key === 'walletRefresh' && e.newValue === '1') {
      // Another page requested a refresh
      localStorage.removeItem('walletRefresh');
      loadDashboardData();
      loadContactData();
    }
    if (e.key === 'walletBalance') {
      // Update displayed balance live if available
      try {
        const v = parseFloat(e.newValue);
        if (!isNaN(v) && dom.walletBalance) dom.walletBalance.textContent = `₹${v.toFixed(2)}`;
      } catch (err) {}
    }
  });
  
  setupEventHandlers();
});

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
    if (!res.ok) throw new Error('Failed to load balance');
    
    const data = await res.json();
    allData.dashboard = data.dashboard;
    
    if (allData.dashboard) {
      dom.userName.textContent = `${allData.dashboard.F_Name} ${allData.dashboard.L_Name}`;
      dom.walletBalance.textContent = `₹${parseFloat(allData.dashboard.Balance).toFixed(2)}`;
        // Populate top-right avatar initials if present
        if (dom.topAvatar && allData.dashboard.F_Name) {
          dom.topAvatar.textContent = allData.dashboard.F_Name[0].toUpperCase();
        }
    }
    
  } catch (error) {
    showAlert(error.message, 'danger');
  }
}

// This loads the contacts for the "Quick Send" widget
async function loadContactData() {
  try {
    const res = await fetch(`${API_URL}/payments/contacts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) return; // Handled by loadDashboardData
    if (!res.ok) throw new Error('Failed to load contacts');

    const data = await res.json();
    allData.users = data.users || [];
    
    renderQuickSend();

  } catch (error) {
    showAlert(error.message, 'danger');
  }
}

function setupEventHandlers() {
  // Sidebar buttons
  dom.actionSendUser.addEventListener('click', () => {
    window.location.href = 'send.html';
  });
  dom.actionPayMerchant.addEventListener('click', () => {
    window.location.href = 'pay-merchant.html';
  });
  dom.actionHistory.addEventListener('click', () => {
    window.location.href = 'history.html';
  });
  if (dom.actionReports) dom.actionReports.addEventListener('click', () => { window.location.href = 'reports.html'; });
  if (dom.actionNotifications) dom.actionNotifications.addEventListener('click', () => { window.location.href = 'notifications.html'; });
  
  // Widget buttons (show alerts for now)
  dom.actionRewards.addEventListener('click', () => {
    // Navigate to the rewards page which shows full rewards history and redeem
    window.location.href = 'rewards.html';
  });
  // Open the refund request form when the user clicks the sidebar button
  dom.actionRefund.addEventListener('click', () => { window.location.href = 'request-refund.html'; });
  
  // EDITED: New listener for the invite button
  dom.inviteBtn.addEventListener('click', () => showAlert('Invite feature coming soon!', 'info'));
  if (dom.actionManageRefunds) dom.actionManageRefunds.addEventListener('click', () => { window.location.href = 'refund-requests.html'; });

  // Logout
  dom.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('walletToken');
    window.location.href = 'login.html';
  });

  // Profile button (top-right) opens profile page
  if (dom.profileBtn) dom.profileBtn.addEventListener('click', () => { window.location.href = 'profile.html'; });
}

function renderQuickSend() {
  // Show first 4 users
  const usersToShow = allData.users.slice(0, 4);
  
  if (usersToShow.length === 0) {
    // Optional: show a message if no contacts
  }

  usersToShow.forEach(user => {
    const item = document.createElement('a');
    item.className = 'quick-contact-item';
    // Link directly to the send page (we can't pre-select yet)
    item.href = 'send.html'; 
    
    item.innerHTML = `
      <div class="avatar-sm">${user.F_Name[0].toUpperCase()}</div>
      <h6>${user.F_Name}</h6>
    `;
    // Prepend (add before) the "Add" button
    dom.quickSendList.prepend(item);
  });
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