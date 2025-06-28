const mongoose = require('mongoose');

const advanceEntrySchema = mongoose.Schema({
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
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  reason: {
    type: String,
    default: 'General advance',
  },
  recordedBy: { // To track who logged the advance
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}, {
  timestamps: true,
});

const AdvanceEntry = mongoose.model('AdvanceEntry', advanceEntrySchema);

module.exports = AdvanceEntry;
