// src/controllers/notificationController.js
const pool = require('../services/db');

/**
 * Get notifications for the logged-in user
 * GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
  const userId = req.userId;
  try {
    const [rows] = await pool.query(
      `SELECT Notification_ID, Message, Status, Date_time
       FROM NOTIFICATION
       WHERE User_ID = ?
       ORDER BY Date_time DESC
       LIMIT 100`,
      [userId]
    );
    res.json({ notifications: rows });
  } catch (error) {
    console.error('GetNotifications error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Mark a notification as read
 * POST /api/notifications/read  { notificationId }
 */
exports.markAsRead = async (req, res) => {
  const userId = req.userId;
  const { notificationId } = req.body;
  if (!notificationId) return res.status(400).json({ message: 'notificationId required' });
  try {
    const [result] = await pool.query('UPDATE NOTIFICATION SET Status = ? WHERE Notification_ID = ? AND User_ID = ?', ['Read', notificationId, userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('MarkAsRead error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Mark all notifications as read
 * POST /api/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {
  const userId = req.userId;
  try {
    await pool.query('UPDATE NOTIFICATION SET Status = ? WHERE User_ID = ?', ['Read', userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('MarkAllAsRead error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
