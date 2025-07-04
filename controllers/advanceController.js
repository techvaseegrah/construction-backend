// construction/backend/controllers/advanceController.js
const asyncHandler = require('express-async-handler');
const AdvanceEntry = require('../models/AdvanceEntry');
const Worker = require('../models/Worker');
const Site = require('../models/Site');
const User = require('../models/User'); // Ensure User model is imported
const mongoose = require('mongoose');

// @desc    Log an advance payment
// @route   POST /api/advances
// @access  Private (Supervisor/Admin)
const createAdvanceLog = asyncHandler(async (req, res) => {
  const {
    workerId,
    siteId,
    amount,
    date,
    reason
  } = req.body;

  const worker = await Worker.findById(workerId);
  const site = await Site.findById(siteId);

  if (!worker || !site) {
    res.status(404).json({
      message: 'Worker or Site not found'
    });
    return;
  }

  if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(siteId)) {
    res.status(403).json({
      message: 'Not authorized to log advance for this site'
    });
    return;
  }

  const isWorkerAssignedToSite = site.assignedWorkers.some(aw => aw.workerId.toString() === workerId);
  if (!isWorkerAssignedToSite) {
    res.status(400).json({
      message: 'Worker is not assigned to this site.'
    });
    return;
  }

  // Always use req.user._id directly for recordedBy.
  // The schema validation will ensure it's an ObjectId.
  const recordedBy = req.user._id;

  const advance = await AdvanceEntry.create({
    workerId,
    siteId,
    amount,
    date: date || Date.now(),
    reason,
    recordedBy: recordedBy, // Use the actual user's ID
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
    query.siteId = siteId;
  }


  const advanceLogs = await AdvanceEntry.find(query)
    .populate('workerId', 'name role')
    .populate('siteId', 'name')
    .populate('recordedBy', 'name role'); // MODIFIED: Populate role of recordedBy

  // MODIFIED: Map results to display 'Admin' if role is admin
  const formattedAdvanceLogs = advanceLogs.map(log => ({
    ...log.toObject(),
    recordedBy: {
      name: log.recordedBy?.role === 'admin' ? 'Admin' : log.recordedBy?.name || 'N/A',
      role: log.recordedBy?.role || 'N/A'
    }
  }));

  res.json(formattedAdvanceLogs);
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