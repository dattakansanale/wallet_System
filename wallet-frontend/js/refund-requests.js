(function(){
  const API_URL = 'http://localhost:5000/api';
  const refundsList = document.getElementById('refunds-list');
  const alertEl = document.getElementById('main-alert');

  function showAlert(message, type='success'){
    alertEl.textContent = message;
    alertEl.className = `alert alert-${type}`;
    alertEl.classList.remove('d-none');
    setTimeout(()=> alertEl.classList.add('d-none'), 4000);
  }

  async function fetchRefunds(){
    const token = localStorage.getItem('walletToken');
    try{
        const res = await fetch(`${API_URL}/refunds/merchant`,{
          headers: { 'Authorization': 'Bearer ' + token }
        });
      if(!res.ok){
        const txt = await res.text();
        let errMsg = 'Failed to load refunds';
        try { const err = JSON.parse(txt); errMsg = err.message || txt; } catch(e) { errMsg = txt || errMsg; }
        refundsList.innerHTML = `<div class="text-center text-muted" style="padding:2rem">${errMsg}</div>`;
        return;
      }
      const txt = await res.text();
      let data;
      try { data = JSON.parse(txt); } catch(e) { throw new Error('Invalid server response'); }
      renderRefunds(data);
    }catch(e){
      refundsList.innerHTML = `<div class="text-center text-muted" style="padding:2rem">${e.message || 'Network error'}</div>`;
    }
  }

  function renderRefunds(list){
    if(!Array.isArray(list) || list.length === 0){
      refundsList.innerHTML = `<div class="text-center text-muted" style="padding:2rem">No refund requests found.</div>`;
      return;
    }
    refundsList.innerHTML = '';
    list.forEach(r => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="item-left">
          <div class="item-title">Refund #${r.Refund_ID} - ${r.Status}</div>
          <div class="muted">Requested by: ${r.Payer_User_ID || 'Unknown'}</div>
          <div class="muted">Txn ID: ${r.Transaction_ID || 'N/A'}</div>
          <div class="muted">Amount: ₹${r.Amount || 0} | Reason: ${r.Reason || '—'}</div>
        </div>
        <div class="item-right" style="min-width:220px; text-align:right">
          <div class="muted">Created: ${new Date(r.Req_Date || r.req_date || Date.now()).toLocaleString()}</div>
          <div style="margin-top:.5rem">
            <button class="btn btn-primary btn-approve" data-id="${r.Refund_ID}">Approve</button>
            <button class="btn btn-secondary btn-decline" data-id="${r.Refund_ID}">Decline</button>
          </div>
        </div>
      `;
      refundsList.appendChild(item);
    });

    // wire buttons
    document.querySelectorAll('.btn-approve').forEach(b => b.addEventListener('click', onApprove));
    document.querySelectorAll('.btn-decline').forEach(b => b.addEventListener('click', onDecline));
  }

  async function onApprove(e){
    const id = e.currentTarget.dataset.id;
    const token = localStorage.getItem('walletToken');
    if(!confirm('Approve refund #' + id + '? This will trigger a refund process.')) return;
    try{
      const res = await fetch(`${API_URL}/refunds/${id}/approve`,{
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
      });
      const txt = await res.text();
      let json;
      try { json = JSON.parse(txt); } catch(_) { json = { message: txt }; }
      if(!res.ok) throw new Error(json.message || 'Failed');
      showAlert(json.message || 'Refund approved');
      fetchRefunds();
    }catch(err){
      showAlert(err.message || 'Error', 'danger');
    }
  }

  async function onDecline(e){
    const id = e.currentTarget.dataset.id;
    const token = localStorage.getItem('walletToken');
    if(!confirm('Decline refund #' + id + '?')) return;
    try{
      const res = await fetch(`${API_URL}/refunds/${id}/decline`,{
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
      });
      const txt = await res.text();
      let json;
      try { json = JSON.parse(txt); } catch(_) { json = { message: txt }; }
      if(!res.ok) throw new Error(json.message || 'Failed');
      showAlert(json.message || 'Refund declined');
      fetchRefunds();
    }catch(err){
      showAlert(err.message || 'Error', 'danger');
    }
  }

  // initial load
  fetchRefunds();
})();
