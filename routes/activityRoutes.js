const express = require('express');
const {
  logActivity,
  getActivityLogs,
  updateActivity,
  deleteActivity
} = require('../controllers/activityController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/log', protect, authorizeRoles('admin', 'supervisor'), logActivity);
router.get('/', protect, authorizeRoles('admin', 'supervisor'), getActivityLogs);
router.route('/:id')
  .put(protect, authorizeRoles('admin', 'supervisor'), updateActivity)
  .delete(protect, authorizeRoles('admin', 'supervisor'), deleteActivity);

module.exports = router;