const express = require('express');
const {
  logMaterial,
  getMaterialEntries,
  updateMaterial,
  deleteMaterial
} = require('../controllers/materialController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/log', protect, authorizeRoles('admin', 'supervisor'), logMaterial);
router.get('/', protect, authorizeRoles('admin', 'supervisor'), getMaterialEntries);
router.route('/:id')
  .put(protect, authorizeRoles('admin', 'supervisor'), updateMaterial)
  .delete(protect, authorizeRoles('admin', 'supervisor'), deleteMaterial);

module.exports = router;
