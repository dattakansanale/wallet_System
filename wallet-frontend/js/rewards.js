// js/rewards.js
const API_URL = 'http://localhost:5000/api';
const token = localStorage.getItem('walletToken');

if (!token) {
  window.location.href = 'login.html';
}

let dom = {};
let rewardsData = { totalPoints: 0, rewards: [] };

document.addEventListener('DOMContentLoaded', () => {
  dom = {
    rewardPoints: document.getElementById('reward-points'),
    redeemBtn: document.getElementById('redeem-btn'),
    rewardsList: document.getElementById('rewards-list')
  };

  if (dom.redeemBtn) dom.redeemBtn.addEventListener('click', handleRedeem);

  loadRewards();
});

async function loadRewards() {
  try {
    const res = await fetch(`${API_URL}/payments/rewards`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
      localStorage.removeItem('walletToken');
      window.location.href = 'login.html';
      return;
    }
    if (!res.ok) {
      // Try to read server message if available
      let errMsg = 'Failed to load rewards';
      try {
        const errBody = await res.json();
        if (errBody && errBody.message) errMsg = errBody.message;
      } catch (e) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    rewardsData = data || { totalPoints: 0, rewards: [] };
    renderRewards();
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

function renderRewards() {
  if (dom.rewardPoints) dom.rewardPoints.textContent = rewardsData.totalPoints || 0;
  if (!dom.rewardsList) return;

  dom.rewardsList.innerHTML = '';
  const items = rewardsData.rewards || [];
  if (items.length === 0) {
    dom.rewardsList.innerHTML = '<div class="text-center text-muted" style="padding: 1.5rem;">No rewards yet.</div>';
    return;
  }

  items.forEach(r => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.innerHTML = `
      <div class="history-info">
        <h6>${r.Description || 'Reward'}</h6>
        <p>${new Date(r.Created_At).toLocaleString()} ${r.Expiry_Date ? `• Expires ${new Date(r.Expiry_Date).toLocaleDateString()}` : ''}</p>
      </div>
      <div class="history-amount ${r.Is_Expired ? '' : 'credit'}">
        +${r.Points} pts
        <small>${r.Is_Expired ? 'used/expired' : ''}</small>
      </div>
    `;
    dom.rewardsList.appendChild(el);
  });
}

async function handleRedeem() {
  if (!confirm('Redeem all available reward points for wallet credit?')) return;
  try {
    const res = await fetch(`${API_URL}/payments/rewards/redeem`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Redeem failed');

    showAlert(`Redeemed ${data.redeemedPoints} pts → ₹${data.amountCredited}`, 'success');
    await loadRewards();
    // Refresh dashboard and share new balance with other pages/tabs
    try {
      localStorage.setItem('walletRefresh', '1');
      // Store new balance so other open pages can update immediately
      if (data.balance != null) localStorage.setItem('walletBalance', data.balance.toString());
    } catch (e) {}
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

// --- Global Alert Function (copied) ---
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
