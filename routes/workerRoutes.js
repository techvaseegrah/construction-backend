const express = require('express');
const {
  getWorkers,
  getWorkerById,
  createWorker,
  updateWorker,
  deleteWorker
} = require('../controllers/workerController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, authorizeRoles('admin', 'supervisor'), getWorkers) // Admin and supervisor can view
  .post(protect, authorizeRoles('admin'), createWorker); // Only admin can create

router.route('/:id')
  .get(protect, authorizeRoles('admin', 'supervisor'), getWorkerById) // Admin and supervisor can view
  .put(protect, authorizeRoles('admin'), updateWorker) // Only admin can update
  .delete(protect, authorizeRoles('admin'), deleteWorker); // Only admin can delete

module.exports = router;