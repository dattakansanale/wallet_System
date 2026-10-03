// src/routes/refundRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getMerchantRefunds, approveRefund, declineRefund } = require('../controllers/refundController');

router.use(authMiddleware);

// GET /api/refunds/merchant
router.get('/merchant', getMerchantRefunds);

// POST /api/refunds/:id/approve
router.post('/:id/approve', approveRefund);

// POST /api/refunds/:id/decline
router.post('/:id/decline', declineRefund);

module.exports = router;
