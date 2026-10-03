// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { login, register, getProfile, updateProfile } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// @route   POST /api/auth/login
router.post('/login', login);

// @route   POST /api/auth/register
router.post('/register', register);

// GET /api/auth/profile - get current user's profile
router.get('/profile', authMiddleware, getProfile);

// PUT /api/auth/profile - update current user's profile
router.put('/profile', authMiddleware, updateProfile);

module.exports = router;