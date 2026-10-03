const API_URL = 'http://localhost:5000/api';
const token = localStorage.getItem('walletToken');

if (!token) window.location.href = 'login.html';

let dailyChart, topChart;

document.addEventListener('DOMContentLoaded', () => {
  const startInput = document.getElementById('report-start');
  const endInput = document.getElementById('report-end');
  const loadBtn = document.getElementById('load-report');
  const csvBtn = document.getElementById('download-csv');
  const reportTypeEl = document.getElementById('report-type');

  // Default to current month
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
  startInput.value = first.toISOString().slice(0,10);
  endInput.value = last.toISOString().slice(0,10);

  loadBtn.addEventListener('click', () => loadReport(startInput.value, endInput.value));
  csvBtn.addEventListener('click', () => downloadCSV(startInput.value, endInput.value));

  // initial load
  loadReport(startInput.value, endInput.value);
});

async function loadReport(start, end) {
  try {
    showAlert('Loading report...', 'info');
    const url = `${API_URL}/reports/monthly?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.status === 401) { localStorage.removeItem('walletToken'); window.location.href = 'login.html'; return; }
    if (!res.ok) {
      const text = await res.text();
      console.error('Report API error', res.status, text);
      throw new Error(`Failed to load report (status ${res.status}): ${text}`);
    }
    const data = await res.json();

    renderSummary(data.summary || {});
    renderDaily(data.daily || []);
    renderTop(data.top_payees || data.top_customers || []);
    populateTopTable(data.top_payees || data.top_customers || []);

    showAlert('Report loaded', 'success');
  } catch (err) {
    console.error('loadReport', err);
    showAlert(err.message || 'Error loading report', 'danger');
  }
}

function renderSummary(s) {
  document.getElementById('kpi-total-sent').textContent = `₹${(s.total_sent||0).toFixed ? (s.total_sent||0).toFixed(2) : parseFloat(s.total_sent||0).toFixed(2)}`;
  document.getElementById('kpi-total-recv').textContent = `₹${(s.total_received||0).toFixed ? (s.total_received||0).toFixed(2) : parseFloat(s.total_received||0).toFixed(2)}`;
  const txCount = (s.tx_count_sent||0) + (s.tx_count_received||0);
  document.getElementById('kpi-count').textContent = txCount;
  document.getElementById('kpi-avg').textContent = `₹${(s.avg_txn_amount||0).toFixed ? (s.avg_txn_amount||0).toFixed(2) : parseFloat(s.avg_txn_amount||0).toFixed(2)}`;
}

function renderDaily(rows) {
  const labels = rows.map(r => r.day);
  const sent = rows.map(r => parseFloat(r.sent||0));
  const recv = rows.map(r => parseFloat(r.received||0));

  const ctx = document.getElementById('chart-daily').getContext('2d');
  if (dailyChart) dailyChart.destroy();
  dailyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Sent', data: sent, borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.08)', tension:0.2, fill:true },
        { label: 'Received', data: recv, borderColor: '#4bc0c0', backgroundColor: 'rgba(75,192,192,0.08)', tension:0.2, fill:true }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderTop(rows) {
  const labels = rows.map(r => r.name || (r.customer_name || 'Unknown'));
  const values = rows.map(r => parseFloat(r.total_amount||r.total_sales||0));

  const ctx = document.getElementById('chart-top').getContext('2d');
  if (topChart) topChart.destroy();
  topChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Amount', data: values, backgroundColor: '#7c5cff' }] },
    options: { indexAxis: 'y', responsive: true, plugins: { legend: { display:false } } }
  });
}

function populateTopTable(rows) {
  const tbody = document.querySelector('#top-table tbody');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    const name = r.name || r.customer_name || r.name || 'Unknown';
    const type = r.Receiver_Type || (r.customer_name ? 'USER' : 'MERCHANT');
    const amount = (r.total_amount || r.total_sales || 0).toFixed ? (r.total_amount || r.total_sales || 0).toFixed(2) : parseFloat(r.total_amount || r.total_sales || 0).toFixed(2);
    const tx = r.tx_count || 0;
    tr.innerHTML = `<td>${escapeHtml(name)}</td><td>${type}</td><td>₹${amount}</td><td>${tx}</td>`;
    tbody.appendChild(tr);
  });
}

function escapeHtml(s) { return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function downloadCSV(start, end) {
  try {
    showAlert('Preparing CSV...', 'info');
    const url = `${API_URL}/reports/monthly/csv?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to download CSV');
    const blob = await res.blob();
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlObj;
    a.download = `monthly-report-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(urlObj);
    showAlert('CSV downloaded', 'success');
  } catch (err) {
    console.error('downloadCSV', err);
    showAlert(err.message || 'Error downloading CSV', 'danger');
  }
}

// Reuse main alert function if present (host page has it). If not, create a minimal one.
function showAlert(message, type) {
  const alert = document.getElementById('main-alert');
  if (alert) {
    alert.textContent = message;
    alert.className = `alert alert-${type}`;
    alert.classList.remove('d-none');
    setTimeout(() => alert.classList.add('d-none'), 3000);
  } else {
    console.log(`${type}: ${message}`);
  }
}
