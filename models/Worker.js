const mongoose = require('mongoose');

const workerSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  role: {
    type: String, // e.g., Mason, Painter, Carpenter
    required: true,
  },
  baseSalary: { // Default daily wage for their role
    type: Number,
    required: true,
  },
  rfidId: { // Unique RFID for attendance (optional, but good for future)
    type: String,
    unique: true,
    sparse: true, // Allows null values to not violate uniqueness
  },
  assignedProjects: [{
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: true,
    },
    siteName: {
      type: String,
      required: true,
    },
    projectSalary: { // Override salary for this specific project
      type: Number,
      default: null, // If null, baseSalary is used
    },
  }],
}, {
  timestamps: true,
});

const Worker = mongoose.model('Worker', workerSchema);

module.exports = Worker;