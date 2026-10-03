(function(){
  const token = localStorage.getItem('walletToken');
  const txnInput = document.getElementById('txn-id');
  const merchantInput = document.getElementById('merchant-id');
  const reasonInput = document.getElementById('reason');
  const submitBtn = document.getElementById('submit-refund');
  const alertEl = document.getElementById('main-alert');

  function showAlert(msg, type='success'){
    alertEl.textContent = msg;
    alertEl.className = `alert alert-${type}`;
    alertEl.classList.remove('d-none');
    setTimeout(()=> alertEl.classList.add('d-none'), 4000);
  }

  submitBtn.addEventListener('click', async () => {
    const transactionId = txnInput.value.trim();
    const merchantId = merchantInput.value.trim();
    const reason = reasonInput.value.trim();
    if (!transactionId || !merchantId || !reason) return showAlert('Please fill all fields', 'danger');

    try{
      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ transactionId, merchantId, reason })
      });
      const json = await res.json();
      if (!res.ok) return showAlert(json.message || 'Failed to submit refund', 'danger');
      showAlert(json.message || 'Refund request submitted');
      // Go back to history after short delay
      setTimeout(()=> window.location.href = 'history.html', 1200);
    }catch(e){
      showAlert(e.message || 'Network error', 'danger');
    }
  });
})();
