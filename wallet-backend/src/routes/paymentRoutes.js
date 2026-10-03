// src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { makePayment, requestRefund, getDashboard, getContacts, getRewards, redeemRewards, getPaymentById } = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes here are protected
router.use(authMiddleware);

// @route   GET /api/payments/dashboard
router.get('/dashboard', getDashboard);

// @route   GET /api/payments/contacts
router.get('/contacts', getContacts);

// (payment detail route added below after other routes to avoid route conflicts)

// @route   GET /api/payments/rewards
router.get('/rewards', getRewards);

// @route   POST /api/payments/rewards/redeem
router.post('/rewards/redeem', redeemRewards);

// @route   POST /api/payments
router.post('/', makePayment);

// @route   POST /api/payments/refund
router.post('/refund', requestRefund); // Using /api/payments/refund for grouping


module.exports = router;

// @route   GET /api/payments/:id
// Note: placed after other explicit routes so strings like '/rewards' don't match this param route
router.get('/:id', getPaymentById);