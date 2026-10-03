// src/controllers/refundController.js
const pool = require('../services/db');

/**
 * GET /api/refunds/merchant
 * Return refund tickets relevant to merchants owned/managed by logged-in user
 */
exports.getMerchantRefunds = async (req, res) => {
  const userId = req.userId;
  try {
    // Find user contact info
    const [userRows] = await pool.query('SELECT Email, Phn_No FROM USER WHERE User_ID = ? LIMIT 1', [userId]);
    if (!userRows || userRows.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = userRows[0];

    // Find merchants that match this user's contact (simple owner matching)
    const [merchants] = await pool.query('SELECT Merchant_ID FROM MERCHANT WHERE Email = ? OR Phn_No = ?', [user.Email, user.Phn_No]);
    const merchantIds = (merchants || []).map(m => m.Merchant_ID);
    if (merchantIds.length === 0) return res.json([]);

    const [refunds] = await pool.query(
      `SELECT RT.Refund_ID, RT.Transaction_ID, RT.Merchant_ID, RT.Reason, RT.Req_Date, RT.Process_Date, RT.Status, RT.Attempts,
              P.Amount, P.User_ID as Payer_User_ID
       FROM REFUND_TICKET RT
       LEFT JOIN PAYMENT P ON RT.Transaction_ID = P.Transaction_ID
       WHERE RT.Merchant_ID IN (?)
       ORDER BY RT.Req_Date DESC
       LIMIT 200`,
      [merchantIds]
    );

    res.json(refunds);
  } catch (error) {
    console.error('GetMerchantRefunds error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


/**
 * POST /api/refunds/:id/approve
 * Merchant approves the refund - calls stored procedure ProcessRefund
 */
exports.approveRefund = async (req, res) => {
  const userId = req.userId;
  const refundId = parseInt(req.params.id, 10);
  if (isNaN(refundId)) return res.status(400).json({ message: 'Invalid refund id' });

  try {
    // Ensure merchant belongs to this user
    const [userRows] = await pool.query('SELECT Email, Phn_No FROM USER WHERE User_ID = ? LIMIT 1', [userId]);
    if (!userRows || userRows.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = userRows[0];

    const [merchants] = await pool.query('SELECT Merchant_ID FROM MERCHANT WHERE Email = ? OR Phn_No = ?', [user.Email, user.Phn_No]);
    const merchantIds = (merchants || []).map(m => m.Merchant_ID);
    if (merchantIds.length === 0) return res.status(403).json({ message: 'No merchant permissions' });

    // Check refund belongs to one of these merchants
    const [rtRows] = await pool.query('SELECT Merchant_ID, Status, Transaction_ID FROM REFUND_TICKET WHERE Refund_ID = ? LIMIT 1', [refundId]);
    if (!rtRows || rtRows.length === 0) return res.status(404).json({ message: 'Refund ticket not found' });
    const rt = rtRows[0];
    if (!merchantIds.includes(rt.Merchant_ID)) return res.status(403).json({ message: 'Not authorized to approve this refund' });
    if (rt.Status !== 'Pending') return res.status(400).json({ message: 'Refund not in pending state' });

    // Call stored procedure to process refund
    const [results] = await pool.query('CALL ProcessRefund(?)', [refundId]);
    const spResponse = results && results[0] && results[0][0] ? results[0][0] : null;

    if (spResponse && spResponse.Result === 'OK') {
      // Notify payer
      const txnId = rt.Transaction_ID;
      const [pRows] = await pool.query('SELECT User_ID FROM PAYMENT WHERE Transaction_ID = ? LIMIT 1', [txnId]);
      if (pRows && pRows.length > 0) {
        const payerId = pRows[0].User_ID;
        await pool.query('INSERT INTO NOTIFICATION (User_ID, Message, Status) VALUES (?, ?, ?)', [payerId, `Refund processed for Txn ID: ${txnId} (Refund ID: ${refundId})`, 'Unread']);
      }
      return res.json({ message: 'Refund processed', refundId });
    } else if (spResponse && spResponse.Result === 'RETRY') {
      return res.status(202).json({ message: 'Refund processing deferred (retry)', refundId });
    } else {
      return res.status(500).json({ message: 'Refund processing failed' });
    }

  } catch (error) {
    console.error('ApproveRefund error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


/**
 * POST /api/refunds/:id/decline
 * Merchant declines a refund request
 */
exports.declineRefund = async (req, res) => {
  const userId = req.userId;
  const refundId = parseInt(req.params.id, 10);
  if (isNaN(refundId)) return res.status(400).json({ message: 'Invalid refund id' });

  try {
    // ownership check similar to approve
    const [userRows] = await pool.query('SELECT Email, Phn_No FROM USER WHERE User_ID = ? LIMIT 1', [userId]);
    if (!userRows || userRows.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = userRows[0];

    const [merchants] = await pool.query('SELECT Merchant_ID FROM MERCHANT WHERE Email = ? OR Phn_No = ?', [user.Email, user.Phn_No]);
    const merchantIds = (merchants || []).map(m => m.Merchant_ID);
    if (merchantIds.length === 0) return res.status(403).json({ message: 'No merchant permissions' });

    const [rtRows] = await pool.query('SELECT Merchant_ID, Transaction_ID, Status FROM REFUND_TICKET WHERE Refund_ID = ? LIMIT 1', [refundId]);
    if (!rtRows || rtRows.length === 0) return res.status(404).json({ message: 'Refund ticket not found' });
    const rt = rtRows[0];
    if (!merchantIds.includes(rt.Merchant_ID)) return res.status(403).json({ message: 'Not authorized to decline this refund' });
    if (rt.Status !== 'Pending') return res.status(400).json({ message: 'Refund not in pending state' });

    await pool.query('UPDATE REFUND_TICKET SET Status = ?, Process_Date = CURRENT_TIMESTAMP(), Attempts = Attempts + 1 WHERE Refund_ID = ?', ['Failed', refundId]);

    // Notify payer about decline
    const [pRows] = await pool.query('SELECT User_ID FROM PAYMENT WHERE Transaction_ID = ? LIMIT 1', [rt.Transaction_ID]);
    if (pRows && pRows.length > 0) {
      const payerId = pRows[0].User_ID;
      await pool.query('INSERT INTO NOTIFICATION (User_ID, Message, Status) VALUES (?, ?, ?)', [payerId, `Refund request declined for Txn ID: ${rt.Transaction_ID} (Refund ID: ${refundId})`, 'Unread']);
    }

    res.json({ message: 'Refund declined' });
  } catch (error) {
    console.error('DeclineRefund error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
