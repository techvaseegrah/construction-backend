// construction/backend/controllers/materialController.js
const asyncHandler = require('express-async-handler');
const MaterialEntry = require('../models/MaterialEntry');
const Site = require('../models/Site');

const mongoose = require('mongoose'); // Import mongoose to use mongoose.Types.ObjectId

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


  // Ensure supervisor is assigned to this site

  if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(siteId)) {
    res.status(403).json({ message: 'Not authorized to log materials for this site' });
    return;
  }


  const total = quantity * pricePerUnit;

  // Determine recordedBy ID: Use actual user ID if it's a valid ObjectId,
  // otherwise, use a placeholder ObjectId for dev users to pass validation.
  let recordedById;
  if (req.user._id === 'dev_admin_id' || req.user._id === 'dev_supervisor_id') {
      // For development users, create a dummy but valid ObjectId.
      // NOTE: This ObjectId won't correspond to a real user in DB unless you manually create one.
      recordedById = new mongoose.Types.ObjectId('60a7b1b3c9f2b1001a4e2d3f'); // A static dummy ObjectId
  } else {
      recordedById = req.user._id; // Use the actual user's ObjectId
  }



  const materialEntry = await MaterialEntry.create({
    siteId,
    material,
    brand,
    quantity,
    unit,
    pricePerUnit,
    total,
    date: new Date(date).setUTCHours(0, 0, 0, 0),

    recordedBy: recordedById, // Use the determined ID

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

    query.material = { $regex: material, $options: 'i' }; // Case-insensitive search

  }
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate).setUTCHours(0, 0, 0, 0),
      $lte: new Date(endDate).setUTCHours(23, 59, 59, 999)
    };
  }


  // Apply site filtering based on user role and provided siteId

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

    .populate('recordedBy', 'name');

  res.json(materialLogs);

});

// @desc    Update a material entry
// @route   PUT /api/materials/:id
// @access  Private (Supervisor/Admin)
const updateMaterialLog = asyncHandler(async (req, res) => {
  const { material, brand, quantity, unit, pricePerUnit, date } = req.body;

  const materialEntry = await MaterialEntry.findById(req.params.id);

  if (materialEntry) {
    // Ensure supervisor is authorized for this site

    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(materialEntry.siteId.toString())) {
      res.status(403).json({ message: 'Not authorized to update material log for this site' });
      return;
    }

    materialEntry.material = material || materialEntry.material;
    materialEntry.brand = brand || materialEntry.brand;
    materialEntry.quantity = quantity || materialEntry.quantity;
    materialEntry.unit = unit || materialEntry.unit;
    materialEntry.pricePerUnit = pricePerUnit || materialEntry.pricePerUnit;

    materialEntry.total = materialEntry.quantity * materialEntry.pricePerUnit; // Recalculate total

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
    // Ensure supervisor is authorized for this site

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