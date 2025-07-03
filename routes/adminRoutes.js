// construction/backend/routes/adminRoutes.js
const express = require('express');
const {
  getAdminDashboardSummary,
  getAdminProjectSummaries, // Import the new function
  assignSitesToSupervisor
} = require('../controllers/adminController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard-summary', protect, authorizeRoles('admin'), getAdminDashboardSummary);
router.get('/project-summaries', protect, authorizeRoles('admin'), getAdminProjectSummaries); // NEW ROUTE
router.put('/supervisors/:id/assign-sites', protect, authorizeRoles('admin'), assignSitesToSupervisor);

module.exports = router;