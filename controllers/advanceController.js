// construction/backend/controllers/advanceController.js
const asyncHandler = require('express-async-handler');
const AdvanceEntry = require('../models/AdvanceEntry');
const Worker = require('../models/Worker');
const Site = require('../models/Site');
const mongoose = require('mongoose'); // Import mongoose to use mongoose.Types.ObjectId

// @desc    Log an advance payment
// @route   POST /api/advances/log
// @access  Private (Supervisor/Admin)
const createAdvanceLog = asyncHandler(async (req, res) => {
  const {
    workerId,
    siteId,
    amount,
    date,
    reason
  } = req.body;


  // Check if worker and site exist

  const worker = await Worker.findById(workerId);
  const site = await Site.findById(siteId);

  if (!worker || !site) {
    res.status(404).json({
      message: 'Worker or Site not found'
    });
    return;
  }

  // Ensure supervisor is assigned to this site

  if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(siteId)) {
    res.status(403).json({
      message: 'Not authorized to log advance for this site'
    });
    return;
  }


  // Ensure worker is assigned to this site

  const isWorkerAssignedToSite = site.assignedWorkers.some(aw => aw.workerId.toString() === workerId);
  if (!isWorkerAssignedToSite) {
    res.status(400).json({
      message: 'Worker is not assigned to this site.'
    });
    return;
  }


  // Determine recordedBy ID: Use actual user ID if it's a valid ObjectId,
  // otherwise, use a placeholder ObjectId for dev users to pass validation.
  let recordedById;
  if (req.user._id === 'dev_admin_id' || req.user._id === 'dev_supervisor_id') {
      // For development users, create a dummy but valid ObjectId.
      // NOTE: This ObjectId won't correspond to a real user in DB unless you manually create one.
      recordedById = new mongoose.Types.ObjectId('60a7b1b3c9f2b1001a4e2d3d'); // A static dummy ObjectId, changed last digit for uniqueness
  } else {
      recordedById = req.user._id; // Use the actual user's ObjectId
  }


  const advance = await AdvanceEntry.create({
    workerId,
    siteId,
    amount,
    date: date || Date.now(),
    reason,

    recordedBy: recordedById, // Use the determined ID

  });

  res.status(201).json(advance);
});

// @desc    Get advance entries (filtered by worker, site, date range)
// @route   GET /api/advances
// @access  Private (Admin/Supervisor)
const getAdvanceLogs = asyncHandler(async (req, res) => {
  const {
    siteId,
    workerId,
    startDate,
    endDate
  } = req.query;
  let query = {};

  if (workerId) {
    query.workerId = workerId;
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
        res.status(403).json({
          message: 'Not authorized to view advances for this site'
        });
        return;
      }
      query.siteId = siteId;
    } else {
      query.siteId = {
        $in: assignedSites
      };
    }
  } else if (siteId) {
    // If user is ADMIN and a specific siteId is requested, apply that siteId filter

    query.siteId = siteId;
  }


  const advanceLogs = await AdvanceEntry.find(query)
    .populate('workerId', 'name role')
    .populate('siteId', 'name')

    .populate('recordedBy', 'name role');

  res.json(advanceLogs);
});

// @desc    Update an advance entry
// @route   PUT /api/advances/:id
// @access  Private (Admin/Supervisor)
const updateAdvanceLog = asyncHandler(async (req, res) => {
  const {
    amount,
    date,
    reason
  } = req.body;

  const advance = await AdvanceEntry.findById(req.params.id);

  if (advance) {
    // Ensure supervisor is authorized for this site

    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(advance.siteId.toString())) {
      res.status(403).json({
        message: 'Not authorized to update advance for this site'
      });
      return;
    }

    advance.amount = amount || advance.amount;
    advance.date = date || advance.date;
    advance.reason = reason || advance.reason;

    const updatedAdvance = await advance.save();
    res.json(updatedAdvance);
  } else {
    res.status(404).json({
      message: 'Advance entry not found'
    });
  }
});

// @desc    Delete an advance entry
// @route   DELETE /api/advances/:id
// @access  Private (Admin/Supervisor)
const deleteAdvanceLog = asyncHandler(async (req, res) => {
  const advance = await AdvanceEntry.findById(req.params.id);

  if (advance) {

    // Ensure supervisor is authorized for this site

    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(advance.siteId.toString())) {
      res.status(403).json({
        message: 'Not authorized to delete advance for this site'
      });
      return;
    }
    await advance.deleteOne();
    res.json({
      message: 'Advance entry removed'
    });
  } else {
    res.status(404).json({
      message: 'Advance entry not found'
    });
  }
});

module.exports = {
  createAdvanceLog,
  getAdvanceLogs,
  updateAdvanceLog,
  deleteAdvanceLog,
};