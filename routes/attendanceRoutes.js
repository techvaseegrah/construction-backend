const express = require('express');
const {
  markAttendance,
  getAttendanceEntries,
  getAttendanceOverview,
  updateAttendance,
  deleteAttendance
} = require('../controllers/attendanceController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/mark', protect, authorizeRoles('admin', 'supervisor'), markAttendance);
router.get('/', protect, authorizeRoles('admin', 'supervisor'), getAttendanceEntries);
router.get('/overview', protect, authorizeRoles('admin'), getAttendanceOverview); // Admin only for overview
router.route('/:id')
  .put(protect, authorizeRoles('admin', 'supervisor'), updateAttendance)
  .delete(protect, authorizeRoles('admin', 'supervisor'), deleteAttendance);

module.exports = router;
