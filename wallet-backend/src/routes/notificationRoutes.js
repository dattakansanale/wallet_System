// src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// GET /api/notifications
router.get('/', getNotifications);

// POST /api/notifications/read
router.post('/read', markAsRead);

// POST /api/notifications/read-all
router.post('/read-all', markAllAsRead);

module.exports = router;
