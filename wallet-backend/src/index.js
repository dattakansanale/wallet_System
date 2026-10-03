// src/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const refundRoutes = require('./routes/refundRoutes');
const reportsRoutes = require('./routes/reportsRoutes');

const app = express();

// Middleware
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON bodies

// Define Routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/reports', reportsRoutes);

// Simple health check route
app.get('/', (req, res) => {
  res.send('Wallet System API is running...');
});

// Debug route: list registered routes (for debugging only)
app.get('/__routes', (req, res) => {
  try {
    const routes = [];
    app._router.stack.forEach(mw => {
      if (mw.route) {
        const methods = Object.keys(mw.route.methods).join(',').toUpperCase();
        routes.push(`${methods} ${mw.route.path}`);
      } else if (mw.name === 'router' && mw.handle && mw.handle.stack) {
        mw.handle.stack.forEach(r => {
          if (r.route) {
            const methods = Object.keys(r.route.methods).join(',').toUpperCase();
            routes.push(`${methods} ${r.route.path}`);
          }
        });
      }
    });
    res.json({ routes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
