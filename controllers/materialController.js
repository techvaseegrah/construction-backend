// construction/backend/controllers/materialController.js
const asyncHandler = require('express-async-handler');
const MaterialEntry = require('../models/MaterialEntry');
const Site = require('../models/Site');
const User = require('../models/User');
const mongoose = require('mongoose'); // Ensure mongoose is imported

// @desc    Log a new material entry
// @route   POST /api/materials
// @access  Private (Supervisor/Admin)
const createMaterialLog = asyncHandler(async (req, res) => {
  const { siteId, material, brand, quantity, unit, pricePerUnit, date } = req.body;

  const site = await Site.findById(siteId);
  if (!site) {
    res.status(404).json({ message: 'Site not found' });
    return;
  }

  if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(siteId)) {
    res.status(403).json({ message: 'Not authorized to log materials for this site' });
    return;
  }

  // Determine recordedBy ID: Use actual user ID if it's a valid ObjectId,
  // otherwise, use a placeholder ObjectId for dev users to pass validation.
  let actualRecordedBy;
  if (req.user._id === 'dev_admin_id' || req.user._id === 'dev_supervisor_id') {
      // Use a static dummy ObjectId for dev users
      actualRecordedBy = new mongoose.Types.ObjectId('60a7b1b3c9f2b1001a4e2d3f');
  } else {
      actualRecordedBy = req.user._id; // Use the actual user's ObjectId
  }

  const total = quantity * pricePerUnit;

  const materialEntry = await MaterialEntry.create({
    siteId,
    material,
    brand,
    quantity,
    unit,
    pricePerUnit,
    total,
    date: new Date(date).setUTCHours(0, 0, 0, 0),
    recordedBy: actualRecordedBy, // Use the determined ID
  });

  res.status(201).json(materialEntry);
});


// @desc    Get material entries
// @route   GET /api/materials
// @access  Private (Admin/Supervisor)
const getMaterialLogs = asyncHandler(async (req, res) => {
  const { siteId, material, startDate, endDate } = req.query;
  let query = {};

  if (material) {
    query.material = { $regex: material, $options: 'i' };
  }
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate).setUTCHours(0, 0, 0, 0),
      $lte: new Date(endDate).setUTCHours(23, 59, 59, 999)
    };
  }

  if (req.user.role === 'supervisor') {
    const assignedSites = req.user.assignedSites.map(id => id.toString());

    if (siteId) {
      if (!assignedSites.includes(siteId)) {
        res.status(403).json({ message: 'Not authorized to view material logs for this site' });
        return;
      }
      query.siteId = siteId;
    } else {
      query.siteId = { $in: assignedSites };
    }
  } else if (siteId) {
    query.siteId = siteId;
  }

  const materialLogs = await MaterialEntry.find(query)
    .populate('siteId', 'name')
    .populate('recordedBy', 'name role');

  const formattedMaterialLogs = materialLogs.map(log => {
    const recordedByName = log.recordedBy ?
      (log.recordedBy.role === 'admin' ? 'Admin' : log.recordedBy.name || 'N/A') :
      'N/A';

    return {
      ...log.toObject(),
      recordedBy: {
        name: recordedByName,
        role: log.recordedBy?.role || 'N/A'
      }
    };
  });

  res.json(formattedMaterialLogs);
});

// @desc    Update a material entry
// @route   PUT /api/materials/:id
// @access  Private (Supervisor/Admin)
const updateMaterialLog = asyncHandler(async (req, res) => {
  const { material, brand, quantity, unit, pricePerUnit, date } = req.body;

  const materialEntry = await MaterialEntry.findById(req.params.id);

  if (materialEntry) {
    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(materialEntry.siteId.toString())) {
      res.status(403).json({ message: 'Not authorized to update material log for this site' });
      return;
    }

    materialEntry.material = material || materialEntry.material;
    materialEntry.brand = brand || materialEntry.brand;
    materialEntry.quantity = quantity || materialEntry.quantity;
    materialEntry.unit = unit || materialEntry.unit;
    materialEntry.pricePerUnit = pricePerUnit || materialEntry.pricePerUnit;
    materialEntry.total = materialEntry.quantity * materialEntry.pricePerUnit;
    materialEntry.date = date ? new Date(date).setUTCHours(0, 0, 0, 0) : materialEntry.date;

    const updatedMaterialEntry = await materialEntry.save();
    res.json(updatedMaterialEntry);
  } else {
    res.status(404).json({ message: 'Material log not found' });
  }
});

// @desc    Delete a material entry
// @route   DELETE /api/materials/:id
// @access  Private (Admin/Supervisor)
const deleteMaterialLog = asyncHandler(async (req, res) => {
  const materialEntry = await MaterialEntry.findById(req.params.id);

  if (materialEntry) {
    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(materialEntry.siteId.toString())) {
      res.status(403).json({ message: 'Not authorized to delete material log for this site' });
      return;
    }
    await materialEntry.deleteOne();
    res.json({ message: 'Material log removed' });
  } else {
    res.status(404).json({ message: 'Material log not found' });
  }
});

module.exports = {
  createMaterialLog,
  getMaterialLogs,
  updateMaterialLog,
  deleteMaterialLog,
};