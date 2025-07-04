// contract/backend/utils/generateToken.js
const jwt = require('jsonwebtoken');

const generateToken = (id, role) => { // Added 'role' parameter for consistency with authController
  // Ensure process.env.JWT_SECRET is correctly accessed here.
  // It MUST match the secret used for verification.
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not defined in generateToken.js!");
    throw new Error("JWT_SECRET environment variable is not set.");
  }
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { // Include role in payload for future checks
    expiresIn: '30d', // Token expires in 30 days
  });
};

module.exports = generateToken;
