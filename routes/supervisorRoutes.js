const express = require('express');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');
const {
  getSupervisorDashboardSummary,
  getMySites
} = require('../controllers/supervisorController');

const router = express.Router();

// All supervisor routes are protected and require 'supervisor' role
router.use(protect, authorizeRoles('supervisor'));

router.get('/dashboard-summary', getSupervisorDashboardSummary);
router.get('/my-sites', getMySites);

module.exports = router;