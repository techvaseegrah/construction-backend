const mongoose = require('mongoose');

const materialEntrySchema = mongoose.Schema({
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true,
  },
  material: {
    type: String,
    required: true,
  },
  brand: {
    type: String,
  },
  quantity: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    required: true, // e.g., 'bags', 'kg', 'units', 'liters'
  },
  pricePerUnit: {
    type: Number,
    required: true,
  },
  total: { // Auto-calculated: quantity * pricePerUnit
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  recordedBy: { // To track who logged the material
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}, {
  timestamps: true,
});

const MaterialEntry = mongoose.model('MaterialEntry', materialEntrySchema);

module.exports = MaterialEntry;