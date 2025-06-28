const express = require('express');
const {
  logAdvance,
  getAdvanceEntries,
  updateAdvance,
  deleteAdvance
} = require('../controllers/advanceController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/log', protect, authorizeRoles('admin', 'supervisor'), logAdvance);
router.get('/', protect, authorizeRoles('admin', 'supervisor'), getAdvanceEntries);
router.route('/:id')
  .put(protect, authorizeRoles('admin', 'supervisor'), updateAdvance)
  .delete(protect, authorizeRoles('admin', 'supervisor'), deleteAdvance);

module.exports = router;
