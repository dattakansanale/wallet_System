// src/controllers/reportsController.js
const pool = require('../services/db');

// Helper to parse date range; defaults to current month
function defaultMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const toISODate = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
  return { start: toISODate(first), end: toISODate(last) };
}

exports.getMonthlyReport = async (req, res) => {
  const userId = req.userId; // from auth middleware
  const type = (req.query.type || 'user').toLowerCase();
  let start = req.query.start;
  let end = req.query.end;
  if (!start || !end) {
    const def = defaultMonthRange();
    start = start || def.start;
    end = end || def.end;
  }

  try {
    if (type === 'merchant') {
      const merchantId = parseInt(req.query.merchantId);
      if (isNaN(merchantId)) return res.status(400).json({ message: 'merchantId required for merchant reports' });

      // Verify requesting user is associated with merchant (simple check: user's email or phone matches merchant contact)
      const [uRows] = await pool.query('SELECT Email, Phn_No FROM USER WHERE User_ID = ? LIMIT 1', [userId]);
      if (!uRows || uRows.length === 0) return res.status(403).json({ message: 'User not found' });
      const user = uRows[0];
      const [mRows] = await pool.query('SELECT Merchant_ID, Name, Email, Phn_No FROM MERCHANT WHERE Merchant_ID = ? LIMIT 1', [merchantId]);
      if (!mRows || mRows.length === 0) return res.status(404).json({ message: 'Merchant not found' });
      const merchant = mRows[0];
      if (merchant.Email !== user.Email && merchant.Phn_No !== user.Phn_No) {
        return res.status(403).json({ message: 'Not authorized for this merchant' });
      }

      // Summary for merchant
      const [summaryRows] = await pool.query(
        `SELECT
          SUM(CASE WHEN Receiver_Type = 'MERCHANT' AND Receiver_Entity_ID = ? AND Status = 'Success' THEN Amount ELSE 0 END) AS total_received,
          COUNT(CASE WHEN Receiver_Type = 'MERCHANT' AND Receiver_Entity_ID = ? AND Status = 'Success' THEN 1 END) AS tx_count_received,
          SUM(CASE WHEN Receiver_Type = 'MERCHANT' AND Receiver_Entity_ID = ? AND Status = 'Refunded' THEN Amount ELSE 0 END) AS refunded_amount
         FROM PAYMENT
         WHERE Receiver_Type = 'MERCHANT' AND Receiver_Entity_ID = ? AND Date_time BETWEEN ? AND ?`,
        [merchantId, merchantId, merchantId, merchantId, start, end]
      );

      const summary = summaryRows[0] || {};

      // Daily sales
      const [dailyRows] = await pool.query(
        `SELECT DATE(Date_time) AS day, SUM(Amount) AS daily_total, COUNT(*) AS tx_count
         FROM PAYMENT
         WHERE Receiver_Type = 'MERCHANT' AND Receiver_Entity_ID = ? AND Status = 'Success' AND Date_time BETWEEN ? AND ?
         GROUP BY day ORDER BY day`,
        [merchantId, start, end]
      );

      // Top customers
      const [topCust] = await pool.query(
        `SELECT P.User_ID AS customer_id, CONCAT(U.F_Name,' ',U.L_Name) AS customer_name, SUM(P.Amount) AS total_sales, COUNT(*) AS tx_count
         FROM PAYMENT P
         LEFT JOIN USER U ON U.User_ID = P.User_ID
         WHERE P.Receiver_Type = 'MERCHANT' AND P.Receiver_Entity_ID = ? AND P.Status = 'Success' AND P.Date_time BETWEEN ? AND ?
         GROUP BY P.User_ID
         ORDER BY total_sales DESC
         LIMIT 10`,
        [merchantId, start, end]
      );

      return res.json({ meta: { type: 'merchant', merchantId, start, end }, summary, daily: dailyRows, top_customers: topCust });
    }

    // USER report (default)
    // Summary
    const [summaryRows] = await pool.query(
      `SELECT
        SUM(CASE WHEN User_ID = ? AND Status = 'Success' THEN Amount ELSE 0 END) AS total_sent,
        SUM(CASE WHEN Receiver_Type = 'USER' AND Receiver_Entity_ID = ? AND Status = 'Success' THEN Amount ELSE 0 END) AS total_received,
        SUM(CASE WHEN User_ID = ? AND Status = 'Success' THEN 1 ELSE 0 END) AS tx_count_sent,
        SUM(CASE WHEN Receiver_Type = 'USER' AND Receiver_Entity_ID = ? AND Status = 'Success' THEN 1 ELSE 0 END) AS tx_count_received,
        SUM(CASE WHEN Status = 'Refunded' AND User_ID = ? THEN Amount ELSE 0 END) AS refunded_amount,
        AVG(CASE WHEN User_ID = ? AND Status = 'Success' THEN Amount ELSE NULL END) AS avg_txn_amount
       FROM PAYMENT
       WHERE (User_ID = ? OR (Receiver_Type = 'USER' AND Receiver_Entity_ID = ?)) AND Date_time BETWEEN ? AND ?`,
      [userId, userId, userId, userId, userId, userId, userId, userId, start, end]
    );

    const summary = summaryRows[0] || {};

    // Daily totals
    const [dailyRows] = await pool.query(
      `SELECT DATE(Date_time) AS day,
         SUM(CASE WHEN User_ID = ? AND Status = 'Success' THEN Amount ELSE 0 END) AS sent,
         SUM(CASE WHEN Receiver_Type = 'USER' AND Receiver_Entity_ID = ? AND Status = 'Success' THEN Amount ELSE 0 END) AS received
       FROM PAYMENT
       WHERE (User_ID = ? OR (Receiver_Type = 'USER' AND Receiver_Entity_ID = ?)) AND Date_time BETWEEN ? AND ?
       GROUP BY day ORDER BY day`,
      [userId, userId, userId, userId, start, end]
    );

    // Top payees (who the user paid) and top payers (who paid the user)
    const [topPayees] = await pool.query(
      `SELECT P.Receiver_Type, P.Receiver_Entity_ID,
         COALESCE((SELECT CONCAT(U.F_Name,' ',U.L_Name) FROM USER U WHERE U.User_ID = P.Receiver_Entity_ID),
                  (SELECT M.Name FROM MERCHANT M WHERE M.Merchant_ID = P.Receiver_Entity_ID),
                  CONCAT(P.Receiver_Type, ' ', P.Receiver_Entity_ID)) AS name,
         SUM(P.Amount) AS total_amount, COUNT(*) AS tx_count
       FROM PAYMENT P
       WHERE P.User_ID = ? AND P.Status = 'Success' AND P.Date_time BETWEEN ? AND ?
       GROUP BY P.Receiver_Type, P.Receiver_Entity_ID
       ORDER BY total_amount DESC
       LIMIT 10`,
      [userId, start, end]
    );

    const [topPayers] = await pool.query(
      `SELECT P.User_ID AS payer_id, CONCAT(U.F_Name,' ',U.L_Name) AS name, SUM(P.Amount) AS total_amount, COUNT(*) AS tx_count
       FROM PAYMENT P
       LEFT JOIN USER U ON U.User_ID = P.User_ID
       WHERE P.Receiver_Type = 'USER' AND P.Receiver_Entity_ID = ? AND P.Status = 'Success' AND P.Date_time BETWEEN ? AND ?
       GROUP BY P.User_ID
       ORDER BY total_amount DESC
       LIMIT 10`,
      [userId, start, end]
    );

    res.json({ meta: { type: 'user', userId, start, end }, summary, daily: dailyRows, top_payees: topPayees, top_payers: topPayers });
  } catch (err) {
    console.error('GetMonthlyReport error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// CSV export
exports.getMonthlyReportCSV = async (req, res) => {
  // Reuse logic from getMonthlyReport by calling it indirectly could be complex; replicate minimal flow
  try {
    const userId = req.userId;
    let start = req.query.start;
    let end = req.query.end;
    if (!start || !end) {
      const def = defaultMonthRange();
      start = start || def.start;
      end = end || def.end;
    }

    // daily
    const [dailyRows] = await pool.query(
      `SELECT DATE(Date_time) AS day,
         SUM(CASE WHEN User_ID = ? AND Status = 'Success' THEN Amount ELSE 0 END) AS sent,
         SUM(CASE WHEN Receiver_Type = 'USER' AND Receiver_Entity_ID = ? AND Status = 'Success' THEN Amount ELSE 0 END) AS received
       FROM PAYMENT
       WHERE (User_ID = ? OR (Receiver_Type = 'USER' AND Receiver_Entity_ID = ?)) AND Date_time BETWEEN ? AND ?
       GROUP BY day ORDER BY day`,
      [userId, userId, userId, userId, start, end]
    );

    // top payees
    const [topPayees] = await pool.query(
      `SELECT P.Receiver_Type, P.Receiver_Entity_ID,
         COALESCE((SELECT CONCAT(U.F_Name,' ',U.L_Name) FROM USER U WHERE U.User_ID = P.Receiver_Entity_ID),
                  (SELECT M.Name FROM MERCHANT M WHERE M.Merchant_ID = P.Receiver_Entity_ID),
                  CONCAT(P.Receiver_Type, ' ', P.Receiver_Entity_ID)) AS name,
         SUM(P.Amount) AS total_amount, COUNT(*) AS tx_count
       FROM PAYMENT P
       WHERE P.User_ID = ? AND P.Status = 'Success' AND P.Date_time BETWEEN ? AND ?
       GROUP BY P.Receiver_Type, P.Receiver_Entity_ID
       ORDER BY total_amount DESC
       LIMIT 10`,
      [userId, start, end]
    );

    // Build CSV string
    let csv = 'Section: Daily\n';
    csv += 'day,sent,received\n';
    dailyRows.forEach(r => { csv += `${r.day},${r.sent || 0},${r.received || 0}\n`; });
    csv += '\nSection: Top Payees\n';
    csv += 'name,type,entity_id,total_amount,tx_count\n';
    topPayees.forEach(r => { csv += `"${(r.name||'').replace(/"/g,'""')}",${r.Receiver_Type},${r.Receiver_Entity_ID},${r.total_amount || 0},${r.tx_count || 0}\n`; });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-report-${userId}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('GetMonthlyReportCSV error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
