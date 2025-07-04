// construction/backend/routes/advanceRoutes.js
const express = require('express');
const {
  createAdvanceLog, // This is the function
  getAdvanceLogs,
  updateAdvanceLog,
  deleteAdvanceLog
} = require('../controllers/advanceController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, authorizeRoles('admin', 'supervisor'), createAdvanceLog); // <--- HERE IT IS: POST to '/'
router.get('/', protect, authorizeRoles('admin', 'supervisor'), getAdvanceLogs);

router.route('/:id')
  .put(protect, authorizeRoles('admin', 'supervisor'), updateAdvanceLog)
  .delete(protect, authorizeRoles('admin', 'supervisor'), deleteAdvanceLog);

module.exports = router;