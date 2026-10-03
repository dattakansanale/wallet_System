// js/history.js
const API_URL = 'http://localhost:5000/api';
const token = localStorage.getItem('walletToken');

// Redirect to login if no token
if (!token) {
  window.location.href = 'login.html'; 
}

// Global state
let allData = {
  dashboard: null,
  history: [],
};

// DOM Elements
let dom = {};

document.addEventListener('DOMContentLoaded', () => {
  dom = {
    dataList: document.getElementById('data-list'),
    rewardPoints: document.getElementById('reward-points'),
    redeemBtn: document.getElementById('redeem-btn'),
    rewardsList: document.getElementById('rewards-list')
  };
  
  loadDashboardData();
  // Hook redeem button
  if (dom.redeemBtn) {
    dom.redeemBtn.addEventListener('click', handleRedeem);
  }
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
    if (!res.ok) {
      let errMsg = 'Failed to load history';
      try {
        const errBody = await res.json();
        if (errBody && errBody.message) errMsg = errBody.message;
      } catch (e) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    allData.dashboard = data.dashboard;
    allData.history = data.history || []; 
    allData.rewards = data.rewards || { totalPoints: 0, rewards: [] };
    
    renderDataList();
    renderRewards();
    
  } catch (error) {
    showAlert(error.message, 'danger');
  }
}

function renderRewards() {
  if (!dom.rewardPoints) return;
  const rw = allData.rewards || {};
  dom.rewardPoints.textContent = rw.totalPoints != null ? rw.totalPoints : 0;

  // Render latest rewards summary
  if (dom.rewardsList) {
    dom.rewardsList.innerHTML = '';
    const items = rw.rewards || [];
    if (items.length === 0) {
      dom.rewardsList.innerHTML = '<div class="text-muted" style="padding:0.5rem;">No rewards yet.</div>';
      return;
    }
    items.slice(0,5).forEach(r => {
      const el = document.createElement('div');
      el.className = 'reward-item';
      el.innerHTML = `<small>${new Date(r.Created_At).toLocaleDateString()}:</small> ${r.Points} pts - ${r.Description || ''} ${r.Is_Expired ? '(used/expired)' : ''}`;
      dom.rewardsList.appendChild(el);
    });
  }
}

async function handleRedeem() {
  if (!confirm('Redeem all available reward points for wallet credit?')) return;
  try {
    const res = await fetch(`${API_URL}/payments/rewards/redeem`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Redeem failed');
    }
    showAlert(`Redeemed ${data.redeemedPoints} pts → ₹${data.amountCredited}`, 'success');
    // reload dashboard to refresh balance and rewards
    await loadDashboardData();
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

function renderDataList() {
  dom.dataList.innerHTML = ''; // Clear list
  
  let itemsFound = allData.history.length;

  if (itemsFound === 0) {
    dom.dataList.innerHTML = `<div class="text-center text-muted" style="padding: 2rem;">No history found.</div>`;
    return;
  }

  allData.history.forEach(txn => {
    const item = createHistoryItem(txn);
    dom.dataList.appendChild(item);
  });
}

function createHistoryItem(txn) {
  const item = document.createElement('div');
  item.className = 'history-item';
  
  const amount = parseFloat(txn.Amount).toFixed(2);
  const isPayer = (allData.dashboard && txn.User_ID === allData.dashboard.User_ID);
  
  const isCredit = !isPayer;
  const isSuccess = txn.Status === 'Success';
  const amountClass = isSuccess ? (isCredit ? 'credit' : 'debit') : '';
  const sign = isCredit ? '+' : '-';
  // Determine counterparty: if the logged-in user is the payer show receiver name, otherwise show sender name
  const counterpartyName = isPayer ? (txn.Receiver_Name || 'Unknown') : (txn.Sender_Name || 'Unknown');

  item.innerHTML = `
    <div class="avatar ${isCredit ? '' : 'merchant'}">
      <i class="fa-solid ${isCredit ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
    </div>
    <div class="history-info">
  <h6>${txn.Description || 'Payment'} ${isCredit ? 'from' : 'to'} ${counterpartyName}</h6>
      <p>${new Date(txn.Date_time).toLocaleString()}</p>
    </div>
    <div class="history-amount ${amountClass}">
      ${isSuccess ? `${sign}₹${amount}` : `₹${amount}`}
      <small>${txn.Status}</small>
    </div>
    <div style="min-width:220px; text-align:left; padding-left:1rem;">
      <div class="txn-id">Txn ID: <span class="txn-val">${txn.Transaction_ID}</span>
        <button class="txn-copy-btn" data-txn="${txn.Transaction_ID}" title="Copy Txn ID"><i class="fa-solid fa-copy"></i></button>
      </div>
    </div>
  `;
  // Wire copy button
  const copyBtn = item.querySelector('.txn-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = copyBtn.dataset.txn;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(String(id));
        } else {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = id;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        showAlert('Transaction ID copied to clipboard', 'success');
      } catch (err) {
        showAlert('Unable to copy Transaction ID', 'danger');
      }
    });
  }
  return item;
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