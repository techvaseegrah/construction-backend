// contract/backend/routes/authRoutes.js
const express = require('express');
const {
  loginUser,
  registerUser,
  getUserProfile, // Changed from getMe to match authController
  getAllUsers,      // Changed from getUsers to match authController
  updateUser,       // Changed from updateUserProfile to match authController
  deleteUser
} = require('../controllers/authController');
const {
  protect,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', loginUser);
router.post('/register', protect, authorizeRoles('admin'), registerUser); // Only admin can register users
router.get('/profile', protect, getUserProfile); // Changed from /me to /profile, and getMe to getUserProfile
router.get('/users', protect, authorizeRoles('admin'), getAllUsers); // Changed from getUsers to getAllUsers
router.route('/users/:id')
  .put(protect, authorizeRoles('admin'), updateUser) // Changed from updateUserProfile to updateUser
  .delete(protect, authorizeRoles('admin'), deleteUser);


module.exports = router;