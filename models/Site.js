const mongoose = require('mongoose');

const siteSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String, // e.g., "Residential", "Commercial", "Industrial"
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  presentDate: {
    type: Date, // Auto present date for attendance tracking, can be updated daily
    default: Date.now,
  },
  supervisors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  assignedWorkers: [{
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    salaryOverride: { // Specific salary for this worker on this project
      type: Number,
      default: null,
    },
  }],
}, {
  timestamps: true,
});

const Site = mongoose.model('Site', siteSchema);

module.exports = Site;