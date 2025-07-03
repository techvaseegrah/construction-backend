// construction/backend/routes/activityRoutes.js
const express = require('express');
const {
  // CORRECTED: Import 'logActivity' to match the controller's export
  logActivity, // This name must match the function defined and exported in activityController.js
  getActivityLogs,
  updateActivity, // This also needs to be updateActivity (without Log) to match the controller's export
  deleteActivity // This also needs to be deleteActivity (without Log) to match the controller's export
} = require('../controllers/activityController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

// Use the correct function name in the route
// The route path is '/' because the router is typically mounted at /api/activities in server.js
router.post('/', protect, authorizeRoles('admin', 'supervisor'), logActivity); // Use logActivity
router.get('/', protect, authorizeRoles('admin', 'supervisor'), getActivityLogs); // Name matches

router.route('/:id')
  .put(protect, authorizeRoles('admin', 'supervisor'), updateActivity) // Use updateActivity
  .delete(protect, authorizeRoles('admin', 'supervisor'), deleteActivity); // Use deleteActivity

module.exports = router;