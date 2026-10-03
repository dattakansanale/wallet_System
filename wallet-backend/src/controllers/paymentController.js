// src/controllers/paymentController.js
const pool = require('../services/db');
const bcrypt = require('bcryptjs');

/**
 * Helper function to verify the user's PIN
 */
const verifyPIN = async (userId, pinToVerify) => {
  try {
    const [rows] = await pool.query(
      'SELECT Wallet_PIN_Hash FROM USER WHERE User_ID = ?',
      [userId]
    );
    if (rows.length === 0) {
      return false; // User not found
    }
    return bcrypt.compare(pinToVerify, rows[0].Wallet_PIN_Hash);
  } catch (error) {
    console.error('PIN verification error:', error);
    return false;
  }
};

/**
 * @route   POST /api/payments
 * @desc    Make a new payment (P2P or Merchant)
 * @access  Private
 */
exports.makePayment = async (req, res) => {
  // req.userId is added by the authMiddleware
  const payerUserId = req.userId; 
  
  const { 
    receiverType, // 'USER' or 'MERCHANT'
    receiverId,   // The User_ID or Merchant_ID
    amount, 
    pin,          // Wallet PIN sent from client
    txnHash,      // Client-generated UUID for idempotency
    description 
  } = req.body;

  // 1. Basic Validation
  if (!receiverType || !receiverId || !amount || !pin || !txnHash || !description) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Validate receiverId is a valid integer and not too large
  const receiverIdInt = parseInt(receiverId);
  if (isNaN(receiverIdInt) || receiverIdInt <= 0 || receiverIdInt > 2147483647) {
    return res.status(400).json({ 
      message: 'Invalid receiver ID. Please use User_ID or Merchant_ID only (not phone numbers).' 
    });
  }

  try {
    // 2. Verify Wallet PIN
    const isPinValid = await verifyPIN(payerUserId, pin);
    if (!isPinValid) {
      return res.status(403).json({ message: 'Invalid Wallet PIN' });
    }

    // 3. Call the Stored Procedure
    const [results] = await pool.query(
      'CALL MakePayment(?, ?, ?, ?, ?, ?)',
      [
        payerUserId,
        receiverType,
        receiverIdInt, // Use the validated integer
        parseFloat(amount),
        txnHash,
        description
      ]
    );

    // The stored procedure returns a result set
    const spResponse = results[0][0];

    // 4. Handle SP Response
    if (spResponse.Status === 'Success') {
      res.status(201).json({ 
        message: 'Payment successful', 
        transactionId: spResponse.Transaction_ID 
      });
    } else if (spResponse.Status === 'Failed') {
      res.status(400).json({ 
        message: 'Payment failed (e.g., insufficient funds)', 
        transactionId: spResponse.Transaction_ID 
      });
    } else if (spResponse.Note === 'ALREADY_EXISTS') {
       res.status(200).json({ 
        message: 'Payment already processed', 
        transactionId: spResponse.Transaction_ID 
      });
    } else {
      res.status(500).json({ message: 'Unknown payment error' });
    }

  } catch (error) {
    console.error('MakePayment SP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


/**
 * @route   POST /api/refunds
 * @desc    Request a refund for a transaction
 * @access  Private
 */
exports.requestRefund = async (req, res) => {
  const { transactionId, merchantId, reason } = req.body;
  const userId = req.userId; // To verify ownership

  if (!transactionId || !merchantId || !reason) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Verify the requester actually paid the transaction
    const [paymentRows] = await pool.query('SELECT User_ID FROM PAYMENT WHERE Transaction_ID = ?', [transactionId]);
    if (paymentRows.length === 0 || paymentRows[0].User_ID !== userId) {
      return res.status(403).json({ message: 'Unauthorized: You cannot request a refund for this transaction.' });
    }

    // Create a pending refund ticket instead of immediately processing the refund.
    const [insertResult] = await pool.query(
      `INSERT INTO REFUND_TICKET (Transaction_ID, Merchant_ID, Reason, Req_Date, Status, Attempts)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP(), 'Pending', 0)`,
      [transactionId, merchantId, reason]
    );

    const refundId = insertResult.insertId;

    // Notify the merchant user account if one exists (match merchant contact to a USER account)
    const [mRows] = await pool.query('SELECT Email, Phn_No, Name FROM MERCHANT WHERE Merchant_ID = ? LIMIT 1', [merchantId]);
    if (mRows && mRows.length > 0) {
      const m = mRows[0];
      // Try to find a user that matches merchant contact
      const [notifyUsers] = await pool.query('SELECT User_ID FROM USER WHERE Email = ? OR Phn_No = ? LIMIT 1', [m.Email, m.Phn_No]);
      if (notifyUsers && notifyUsers.length > 0) {
        const merchantUserId = notifyUsers[0].User_ID;
        await pool.query('INSERT INTO NOTIFICATION (User_ID, Message, Status) VALUES (?, ?, ?)', [
          merchantUserId,
          `Refund requested for Txn ID: ${transactionId} (Refund ID: ${refundId}). Reason: ${reason}`,
          'Unread'
        ]);
      }
    }

    // Notify the requester that refund ticket was created
    await pool.query('INSERT INTO NOTIFICATION (User_ID, Message, Status) VALUES (?, ?, ?)', [
      userId,
      `Refund request submitted for Txn ID: ${transactionId} (Refund ID: ${refundId}).`,
      'Unread'
    ]);

    res.status(201).json({ message: 'Refund request created', refundId });

  } catch (error) {
    console.error('RequestRefund error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


/**
 * @route   GET /api/wallet/dashboard
 * @desc    Get user's balance and recent transactions
 * @access  Private
 */
exports.getDashboard = async (req, res) => {
  const userId = req.userId;

  try {
    // 1. Get Wallet Info
    const [walletRows] = await pool.query(
      `SELECT W.Balance, U.F_Name, U.L_Name, U.User_ID
       FROM WALLET W
       JOIN USER U ON W.User_ID = U.User_ID
       WHERE W.User_ID = ?`,
      [userId]
    );

    if (walletRows.length === 0) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // 2. Get Recent Transactions (using WALLET_TRANSACTIONS ledger)
    const [txnRows] = await pool.query(
      `SELECT Txn_Type, Amount, Remarks, Created_At 
       FROM WALLET_TRANSACTIONS
       WHERE Wallet_ID = (SELECT Wallet_ID FROM WALLET WHERE User_ID = ?)
       ORDER BY Created_At DESC
       LIMIT 10`,
      [userId]
    );
    
    // 3. Get Full Payment History (include incoming payments where the logged-in user is the receiver)
    // Also include Sender_Name so the frontend can show the correct counterparty for incoming txns
    const [paymentRows] = await pool.query(
      `SELECT P.Transaction_ID, P.Amount, P.Status, P.Date_time, PH.Description,
              P.Receiver_Type, P.Receiver_Entity_ID, P.User_ID,
              -- Receiver name (merchant or user)
              CASE 
                WHEN P.Receiver_Type = 'MERCHANT' THEN (SELECT M.Name FROM MERCHANT M WHERE M.Merchant_ID = P.Receiver_Entity_ID)
                WHEN P.Receiver_Type = 'USER' THEN (SELECT CONCAT(U.F_Name, ' ', U.L_Name) FROM USER U WHERE U.User_ID = P.Receiver_Entity_ID)
                ELSE 'Unknown'
              END AS Receiver_Name,
              -- Sender name (user who initiated the payment)
              (SELECT CONCAT(S.F_Name, ' ', S.L_Name) FROM USER S WHERE S.User_ID = P.User_ID) AS Sender_Name
       FROM PAYMENT P
       LEFT JOIN PAYMENT_HISTORY PH ON P.Transaction_ID = PH.Transaction_ID
       WHERE P.User_ID = ?
          OR (P.Receiver_Type = 'USER' AND P.Receiver_Entity_ID = ?)
       ORDER BY P.Date_time DESC
       LIMIT 20`,
      [userId, userId]
    );

    // 4. Get rewards summary for dashboard
    const [totalRow] = await pool.query('SELECT GetUserRewardPoints(?) AS TotalPoints', [userId]);
    const totalPoints = (totalRow && totalRow[0]) ? totalRow[0].TotalPoints : 0;
    const [rewardsRows] = await pool.query(
      `SELECT Reward_ID, Points, Expiry_Date, Description, Is_Expired, Created_At
       FROM REWARDS
       WHERE User_ID = ?
       ORDER BY Created_At DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      dashboard: walletRows[0],
      ledger: txnRows,
      history: paymentRows,
      rewards: { totalPoints: totalPoints || 0, rewards: rewardsRows }
    });

  } catch (error) {
    console.error('GetDashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @route   GET /api/payments/contacts
 * @desc    Get all users and merchants for contact list
 * @access  Private
 */
exports.getContacts = async (req, res) => {
  const userId = req.userId; // ID of the logged-in user

  try {
    // 1. Get all other users (excluding self)
    const [users] = await pool.query(
      `SELECT User_ID, F_Name, L_Name, Phn_No 
       FROM USER 
       WHERE User_ID != ?`,
      [userId]
    );

    // 2. Get all merchants
    const [merchants] = await pool.query(
      `SELECT Merchant_ID, Name, Business_Type 
       FROM MERCHANT`
    );

    res.json({
      users: users,
      merchants: merchants
    });

  } catch (error)
    {
    console.error('GetContacts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


/**
 * @route   GET /api/payments/rewards
 * @desc    Return rewards list and total points for the user
 * @access  Private
 */
exports.getRewards = async (req, res) => {
  const userId = req.userId;
  try {
    const [totalRow] = await pool.query('SELECT GetUserRewardPoints(?) AS TotalPoints', [userId]);
    const totalPoints = (totalRow && totalRow[0]) ? totalRow[0].TotalPoints : 0;

    const [rewardsRows] = await pool.query(
      `SELECT Reward_ID, Points, Expiry_Date, Description, Is_Expired, Created_At
       FROM REWARDS
       WHERE User_ID = ?
       ORDER BY Created_At DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ totalPoints: totalPoints || 0, rewards: rewardsRows });
  } catch (error) {
    console.error('GetRewards error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


/**
 * @route   POST /api/payments/rewards/redeem
 * @desc    Redeem all available reward points into wallet balance.
 * @access  Private
 *
 * Note: Assumption - conversion rate is 100 points = ₹1 (1 point = ₹0.01). This can be changed later.
 */
exports.redeemRewards = async (req, res) => {
  const userId = req.userId;
  // Conversion rate: 1 reward point = ₹1 (user requested 1 point equals one rupee)
  const conversionRate = 1.0; // 1 point = ₹1

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Calculate total available points (non-expired)
    const [ptsRows] = await conn.query(
      `SELECT COALESCE(SUM(Points), 0) AS TotalPoints
       FROM REWARDS
       WHERE User_ID = ? AND Is_Expired = 0 AND (Expiry_Date IS NULL OR Expiry_Date >= CURRENT_DATE())`,
      [userId]
    );

    const totalPoints = (ptsRows && ptsRows[0]) ? ptsRows[0].TotalPoints : 0;
    if (!totalPoints || totalPoints <= 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'No redeemable reward points available' });
    }

    const creditAmount = parseFloat((totalPoints * conversionRate).toFixed(2));

    // Get user's wallet
    const [walletRows] = await conn.query('SELECT Wallet_ID, Balance FROM WALLET WHERE User_ID = ? FOR UPDATE', [userId]);
    if (!walletRows || walletRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ message: 'Wallet not found for user' });
    }
    const walletId = walletRows[0].Wallet_ID;

    // Credit wallet and insert ledger
    await conn.query('UPDATE WALLET SET Balance = Balance + ?, Last_update = CURRENT_TIMESTAMP WHERE Wallet_ID = ?', [creditAmount, walletId]);
    await conn.query(
      'INSERT INTO WALLET_TRANSACTIONS (Wallet_ID, Txn_Type, Amount, Remarks) VALUES (?, ?, ?, ?)',
      [walletId, 'CREDIT', creditAmount, `Redeemed rewards: ${totalPoints} pts`]
    );

    // Mark used rewards as expired (prevent double redeem)
    await conn.query(
      `UPDATE REWARDS SET Is_Expired = 1 WHERE User_ID = ? AND Is_Expired = 0 AND (Expiry_Date IS NULL OR Expiry_Date >= CURRENT_DATE())`,
      [userId]
    );

    // Notify user
    await conn.query('INSERT INTO NOTIFICATION (User_ID, Message, Status) VALUES (?, ?, ?)', [
      userId,
      `Rewards redeemed: ${totalPoints} pts = ₹${creditAmount.toFixed(2)}`,
      'Unread'
    ]);

    await conn.commit();

    // Fetch updated balance
    const [newWalletRow] = await pool.query('SELECT Balance FROM WALLET WHERE Wallet_ID = ?', [walletId]);

    conn.release();
    res.json({ message: 'Rewards redeemed', redeemedPoints: totalPoints, amountCredited: creditAmount, balance: newWalletRow[0].Balance });
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error('RedeemRewards error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


/**
 * @route   GET /api/payments/:id
 * @desc    Get payment details by Transaction_ID
 * @access  Private
 */
exports.getPaymentById = async (req, res) => {
  const txnId = parseInt(req.params.id);
  if (isNaN(txnId)) return res.status(400).json({ message: 'Invalid transaction id' });

  try {
    const [rows] = await pool.query(
      `SELECT P.Transaction_ID, P.Amount, P.Status, P.Date_time, PH.Description,
              P.Receiver_Type, P.Receiver_Entity_ID, P.User_ID,
              (SELECT CONCAT(S.F_Name, ' ', S.L_Name) FROM USER S WHERE S.User_ID = P.User_ID) AS Sender_Name,
              CASE WHEN P.Receiver_Type = 'MERCHANT' THEN (SELECT M.Name FROM MERCHANT M WHERE M.Merchant_ID = P.Receiver_Entity_ID)
                   WHEN P.Receiver_Type = 'USER' THEN (SELECT CONCAT(U.F_Name, ' ', U.L_Name) FROM USER U WHERE U.User_ID = P.Receiver_Entity_ID)
                   ELSE 'Unknown' END AS Receiver_Name
       FROM PAYMENT P
       LEFT JOIN PAYMENT_HISTORY PH ON P.Transaction_ID = PH.Transaction_ID
       WHERE P.Transaction_ID = ?
       LIMIT 1`,
      [txnId]
    );

    if (!rows || rows.length === 0) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ payment: rows[0] });
  } catch (error) {
    console.error('GetPaymentById error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};