const express = require('express');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');
const {
  getAdminDashboardSummary,
  assignSitesToSupervisor
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes are protected and require 'admin' role
router.use(protect, authorizeRoles('admin'));

router.get('/dashboard-summary', getAdminDashboardSummary);
router.put('/supervisors/:id/assign-sites', assignSitesToSupervisor);

module.exports = router;