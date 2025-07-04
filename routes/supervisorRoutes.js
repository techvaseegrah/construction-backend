// construction/backend/routes/supervisorRoutes.js
const express = require('express');
const {
  getSupervisorDashboardSummary,
  getSupervisorSiteSummaries, // Import the new function
  getMySites
} = require('../controllers/supervisorController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard-summary', protect, authorizeRoles('supervisor'), getSupervisorDashboardSummary);
router.get('/site-summaries', protect, authorizeRoles('supervisor'), getSupervisorSiteSummaries); // NEW ROUTE
router.get('/my-sites', protect, authorizeRoles('supervisor'), getMySites);
router.get('/my-sites/:id', protect, authorizeRoles('supervisor'), getMySites); // This route seems redundant if getMySites is for all.
// If getMySites is intended to fetch a single site by ID, it should be like:
// router.get('/my-sites/:id', protect, authorizeRoles('supervisor'), getSingleMySite);
// For now, we rely on /projects/:id for single site details.

module.exports = router;