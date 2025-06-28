const asyncHandler = require('express-async-handler');
const MaterialEntry = require('../models/MaterialEntry');
const Site = require('../models/Site');

// @desc    Log raw material entry
// @route   POST /api/materials/log
// @access  Private (Supervisor/Admin)
const logMaterial = asyncHandler(async (req, res) => {
  const {
    siteId,
    material,
    brand,
    quantity,
    unit,
    pricePerUnit,
    date
  } = req.body;

  // Check if site exists
  const site = await Site.findById(siteId);
  if (!site) {
    res.status(404).json({
      message: 'Site not found'
    });
    return;
  }

  // Ensure supervisor is assigned to this site
  if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(siteId)) {
    res.status(403).json({
      message: 'Not authorized to log material for this site'
    });
    return;
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
    date: date || Date.now(),
    recordedBy: req.user._id,
  });

  res.status(201).json(materialEntry);
});

// @desc    Get material entries (filtered by site, date range, material)
// @route   GET /api/materials
// @access  Private (Admin/Supervisor)
const getMaterialEntries = asyncHandler(async (req, res) => {
  const {
    siteId,
    material,
    startDate,
    endDate
  } = req.query;
  let query = {};

  if (siteId) {
    query.siteId = siteId;
  }
  if (material) {
    query.material = material;
  }
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate).setUTCHours(0, 0, 0, 0),
      $lte: new Date(endDate).setUTCHours(23, 59, 59, 999)
    };
  }

  // If supervisor, filter by assigned sites
  if (req.user.role === 'supervisor') {
    const assignedSites = req.user.assignedSites;
    if (query.siteId && !assignedSites.includes(query.siteId)) {
      res.status(403).json({
        message: 'Not authorized to view material logs for this site'
      });
      return;
    }
    query.siteId = {
      $in: assignedSites
    };
  }

  const materialEntries = await MaterialEntry.find(query)
    .populate('siteId', 'name')
    .populate('recordedBy', 'name role');

  res.json(materialEntries);
});

// @desc    Update a material entry
// @route   PUT /api/materials/:id
// @access  Private (Admin/Supervisor)
const updateMaterial = asyncHandler(async (req, res) => {
  const {
    material,
    brand,
    quantity,
    unit,
    pricePerUnit,
    date
  } = req.body;

  const materialEntry = await MaterialEntry.findById(req.params.id);

  if (materialEntry) {
    // Ensure supervisor is authorized for this site
    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(materialEntry.siteId.toString())) {
      res.status(403).json({
        message: 'Not authorized to update material log for this site'
      });
      return;
    }

    materialEntry.material = material || materialEntry.material;
    materialEntry.brand = brand || materialEntry.brand;
    materialEntry.quantity = quantity !== undefined ? quantity : materialEntry.quantity;
    materialEntry.unit = unit || materialEntry.unit;
    materialEntry.pricePerUnit = pricePerUnit !== undefined ? pricePerUnit : materialEntry.pricePerUnit;
    materialEntry.date = date || materialEntry.date;
    materialEntry.total = materialEntry.quantity * materialEntry.pricePerUnit; // Recalculate total

    const updatedMaterial = await materialEntry.save();
    res.json(updatedMaterial);
  } else {
    res.status(404).json({
      message: 'Material entry not found'
    });
  }
});

// @desc    Delete a material entry
// @route   DELETE /api/materials/:id
// @access  Private (Admin/Supervisor)
const deleteMaterial = asyncHandler(async (req, res) => {
  const materialEntry = await MaterialEntry.findById(req.params.id);

  if (materialEntry) {
    // Ensure supervisor is authorized for this site
    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(materialEntry.siteId.toString())) {
      res.status(403).json({
        message: 'Not authorized to delete material log for this site'
      });
      return;
    }
    await materialEntry.deleteOne();
    res.json({
      message: 'Material entry removed'
    });
  } else {
    res.status(404).json({
      message: 'Material entry not found'
    });
  }
});

module.exports = {
  logMaterial,
  getMaterialEntries,
  updateMaterial,
  deleteMaterial,
};