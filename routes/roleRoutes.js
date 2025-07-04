const express = require('express');
const {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole
} = require('../controllers/roleController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, authorizeRoles('admin', 'supervisor'), getRoles) // Admin and supervisor can view
  .post(protect, authorizeRoles('admin'), createRole); // Only admin can create

router.route('/:id')
  .get(protect, authorizeRoles('admin'), getRoleById) // Only admin can view single role (supervisor typically doesn't need this)
  .put(protect, authorizeRoles('admin'), updateRole) // Only admin can update
  .delete(protect, authorizeRoles('admin'), deleteRole); // Only admin can delete

module.exports = router;