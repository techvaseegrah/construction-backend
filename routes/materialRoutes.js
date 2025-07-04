// construction/backend/routes/materialRoutes.js
const express = require('express');
const {
  // CORRECTED NAMES to match materialController exports
  createMaterialLog, // Was logMaterial
  getMaterialLogs,   // Was getMaterialEntries
  updateMaterialLog, // Was updateMaterial
  deleteMaterialLog  // Was deleteMaterial
} = require('../controllers/materialController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

// Use the corrected function names in the routes
router.post('/', protect, authorizeRoles('admin', 'supervisor'), createMaterialLog); // Changed /log to / as per common REST API
router.get('/', protect, authorizeRoles('admin', 'supervisor'), getMaterialLogs);

router.route('/:id')
  .put(protect, authorizeRoles('admin', 'supervisor'), updateMaterialLog)
  .delete(protect, authorizeRoles('admin', 'supervisor'), deleteMaterialLog);

module.exports = router;