// src/routes/reportsRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const reports = require('../controllers/reportsController');

// GET /api/reports/monthly?start=...&end=...            -> JSON report
router.get('/monthly', auth, reports.getMonthlyReport);

// GET /api/reports/monthly/csv?start=...&end=...        -> CSV download
router.get('/monthly/csv', auth, reports.getMonthlyReportCSV);

module.exports = router;
