const mongoose = require('mongoose');

const attendanceEntrySchema = mongoose.Schema({
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true,
  },
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true,
  },
  date: {
    type: Date,
    required: true,
    // Ensure only one entry per worker per site per day (could use unique compound index)
  },
  shiftType: {
    type: String,
    enum: ['Full Day', 'One-and-a-Half Day', 'Half Day Morning', 'Half Day Evening'],
    required: true,
  },
  multiplier: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Compound unique index to prevent duplicate attendance entries for the same worker on the same site on the same day
attendanceEntrySchema.index({
  workerId: 1,
  siteId: 1,
  date: 1
}, {
  unique: true
});

const AttendanceEntry = mongoose.model('AttendanceEntry', attendanceEntrySchema);

module.exports = AttendanceEntry;
