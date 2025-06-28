const express = require('express');
const {
  generateReport,
  calculateAndLogWeeklySalaries
} = require('../controllers/reportController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/generate', protect, authorizeRoles('admin', 'supervisor'), generateReport);
router.post('/calculate-weekly-salaries', protect, authorizeRoles('admin'), calculateAndLogWeeklySalaries); // Admin only

module.exports = router;