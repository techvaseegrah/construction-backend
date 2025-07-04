// contract/backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User'); // Import the User model

// Protect routes - ensure user is logged in
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check if Authorization header exists and starts with Bearer
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Ensure process.env.JWT_SECRET is correctly accessed here.
      if (!process.env.JWT_SECRET) {
        console.error("CRITICAL ERROR: JWT_SECRET environment variable is not set in backend!");
        res.status(500);
        throw new Error("Server misconfiguration: JWT_SECRET is not set.");
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('authMiddleware Protect: Decoded Token ID:', decoded.id, 'Role:', decoded.role);

      // --- IMPORTANT FIX START ---
      // Check if the decoded ID is a special development ID
      if (decoded.id === 'dev_admin_id') {
        req.user = { _id: 'dev_admin_id', role: 'admin', name: 'Dev Admin' };
      } else if (decoded.id === 'dev_supervisor_id') {
        req.user = { _id: 'dev_supervisor_id', role: 'supervisor', name: 'Dev Supervisor', assignedSites: [] };
      } else {
        // If it's not a dev ID, proceed to find the user in the database
        req.user = await User.findById(decoded.id).select('-password');
      }
      // --- IMPORTANT FIX END ---

      // If user (real or dev placeholder) is not found
      if (!req.user) {
        res.status(401); // Unauthorized
        throw new Error('Not authorized, user in token not found (or invalid dev ID)');
      }

      next(); // Proceed to the next middleware/route handler

    } catch (error) {
      console.error("Authentication Error (Middleware):", error.name, error.message);
      res.status(401); // Unauthorized for any token-related failures
      if (error.name === 'TokenExpiredError') {
        throw new Error('Not authorized, token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Not authorized, token invalid');
      } else if (error.name === 'CastError' && error.path === '_id') {
        // Specifically catch CastError for _id when it's not a dev ID
        throw new Error('Not authorized, invalid user ID format in token');
      } else {
        throw new Error('Not authorized, token failed verification');
      }
    }
  } else { // If no token is provided in the Authorization header
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }
});

// Authorize roles - restrict access based on user role
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403); // Forbidden
      throw new Error(`User role ${req.user ? req.user.role : 'unknown'} is not authorized to access this route`);
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };