// js/notifications.js
const API_URL = 'http://localhost:5000/api';
const token = localStorage.getItem('walletToken');

if (!token) {
  window.location.href = 'login.html';
}

let dom = {};

document.addEventListener('DOMContentLoaded', () => {
  dom = {
    list: document.getElementById('notifications-list'),
    markAllBtn: document.getElementById('mark-all-read')
  };

  if (dom.markAllBtn) dom.markAllBtn.addEventListener('click', handleMarkAll);

  loadNotifications();
  setupModal();
});

async function loadNotifications() {
  try {
    const res = await fetch(`${API_URL}/notifications`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
      localStorage.removeItem('walletToken');
      window.location.href = 'login.html';
      return;
    }
    if (!res.ok) {
      let err = 'Failed to load notifications';
      try { const b = await res.json(); if (b && b.message) err = b.message; } catch(e){}
      throw new Error(err);
    }

    const data = await res.json();
    renderNotifications(data.notifications || []);
    // Update badge in sidebar if present
    try {
      const unread = (data.notifications || []).filter(n => n.Status === 'Unread').length;
      const badge = document.getElementById('notif-badge');
      if (badge) {
        if (unread > 0) {
          badge.textContent = unread;
          badge.classList.remove('d-none');
        } else {
          badge.classList.add('d-none');
        }
      }
    } catch (e) {}

  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

function renderNotifications(items) {
  if (!dom.list) return;
  dom.list.innerHTML = '';
  if (items.length === 0) {
    dom.list.innerHTML = '<div class="text-center text-muted" style="padding:1.5rem;">No notifications.</div>';
    return;
  }

  items.forEach(n => {
    const el = document.createElement('div');
    el.className = 'history-item';
    // Show a red dot if unread
    const unreadDot = n.Status === 'Unread' ? '<span class="notif-dot" style="display:inline-block;width:10px;height:10px;background:#e74c3c;border-radius:50%;margin-right:0.5rem;"></span>' : '';
    el.innerHTML = `
      <div class="history-info">
        <h6>${unreadDot}${n.Message}</h6>
        <p>${new Date(n.Date_time).toLocaleString()}</p>
      </div>
      <div class="history-amount ${n.Status === 'Unread' ? 'credit' : ''}">
        <small>${n.Status}</small>
      </div>
    `;
    el.addEventListener('click', () => openNotification(n, el));
    dom.list.appendChild(el);
  });
}

async function markAsRead(id, el) {
  try {
    const res = await fetch(`${API_URL}/notifications/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id })
    });
    if (!res.ok) {
      let err = 'Failed to mark as read';
      try { const b = await res.json(); if (b && b.message) err = b.message; } catch(e){}
      throw new Error(err);
    }
    // update UI
    if (el) {
      const statusEl = el.querySelector('.history-amount small');
      const dot = el.querySelector('.notif-dot');
      if (statusEl) statusEl.textContent = 'Read';
      if (dot) dot.remove();
    }
    // refresh badge
    loadNotifications();
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

// --- Modal logic ---
function setupModal() {
  const modal = document.getElementById('notif-modal');
  const closeBtn = document.getElementById('notif-modal-close');
  const backdrop = document.getElementById('notif-backdrop');
  if (!modal) return;
  closeBtn.addEventListener('click', hideModal);
  backdrop.addEventListener('click', hideModal);
}

function showModal(title, body, meta) {
  const modal = document.getElementById('notif-modal');
  if (!modal) return;
  document.getElementById('notif-title').textContent = title || 'Notification';
  document.getElementById('notif-body').textContent = body || '';
  document.getElementById('notif-meta').textContent = meta || '';
  modal.classList.remove('d-none');
}

function hideModal() {
  const modal = document.getElementById('notif-modal');
  if (!modal) return;
  modal.classList.add('d-none');
}

async function openNotification(n, el) {
  // Mark as read first
  try {
    await markAsRead(n.Notification_ID, el);
  } catch (e) {
    // continue even if markAsRead fails
  }

  // Show modal with details. If message contains Txn ID, fetch payment details
  const txnMatch = (n.Message || '').match(/Txn ID:\s*(\d+)/i);
  if (txnMatch) {
    const txnId = txnMatch[1];
    try {
      const res = await fetch(`${API_URL}/payments/${txnId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const p = data.payment;
        const title = `Transaction ₹${parseFloat(p.Amount).toFixed(2)} - ${p.Status}`;
        const body = `${p.Description || ''}\n\nFrom: ${p.Sender_Name || 'Unknown'}\nTo: ${p.Receiver_Name || 'Unknown'}`;
        const meta = `${new Date(p.Date_time).toLocaleString()} • Txn ID: ${p.Transaction_ID}`;
        showModal(title, body, meta);
        return;
      }
    } catch (err) {
      // ignore and show fallback
    }
  }

  // Generic display
  showModal('Notification', n.Message || '', new Date(n.Date_time).toLocaleString());
}

async function handleMarkAll() {
  if (!confirm('Mark all notifications as read?')) return;
  try {
    const res = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      let err = 'Failed to mark all as read';
      try { const b = await res.json(); if (b && b.message) err = b.message; } catch(e){}
      throw new Error(err);
    }
    loadNotifications();
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

// --- Global alert (copied) ---
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
