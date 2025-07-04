const express = require('express');
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
} = require('../controllers/projectController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, authorizeRoles('admin', 'supervisor'), getProjects) // Admin and supervisor can view
  .post(protect, authorizeRoles('admin'), createProject); // Only admin can create

router.route('/:id')
  .get(protect, authorizeRoles('admin', 'supervisor'), getProjectById) // Admin and supervisor can view
  .put(protect, authorizeRoles('admin'), updateProject) // Only admin can update
  .delete(protect, authorizeRoles('admin'), deleteProject); // Only admin can delete

module.exports = router;