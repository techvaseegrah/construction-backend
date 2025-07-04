// construction/backend/routes/reportRoutes.js
const express = require('express');
const {
  generateReport,
  calculateAndLogWeeklySalaries, // UNCOMMENTED: Import the new function
  getSalaryLogs, // Import for the Salary & Advance Logs page
  updateSalaryLogPaidStatus, // Import for managing paid status
} = require('../controllers/reportController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/generate', protect, authorizeRoles('admin', 'supervisor'), generateReport);
// UNCOMMENTED: Add the route for calculate-weekly-salaries
router.post('/calculate-weekly-salaries', protect, authorizeRoles('admin'), calculateAndLogWeeklySalaries); // Admin only

// Routes for Salary Logs (for the Salary & Advance Logs page)
router.get('/salary-logs', protect, authorizeRoles('admin', 'supervisor'), getSalaryLogs);
router.put('/salary-logs/:id/paid', protect, authorizeRoles('admin'), updateSalaryLogPaidStatus);


module.exports = router;