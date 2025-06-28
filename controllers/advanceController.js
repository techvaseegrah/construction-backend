const asyncHandler = require('express-async-handler');
const AdvanceEntry = require('../models/AdvanceEntry');
const Worker = require('../models/Worker');
const Site = require('../models/Site');

// @desc    Log an advance payment
// @route   POST /api/advances/log
// @access  Private (Supervisor/Admin)
const logAdvance = asyncHandler(async (req, res) => {
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

  const advance = await AdvanceEntry.create({
    workerId,
    siteId,
    amount,
    date: date || Date.now(),
    reason,
    recordedBy: req.user._id,
  });

  res.status(201).json(advance);
});

// @desc    Get advance entries (filtered by worker, site, date range)
// @route   GET /api/advances
// @access  Private (Admin/Supervisor)
const getAdvanceEntries = asyncHandler(async (req, res) => {
  const {
    workerId,
    siteId,
    startDate,
    endDate
  } = req.query;
  let query = {};

  if (workerId) {
    query.workerId = workerId;
  }
  if (siteId) {
    query.siteId = siteId;
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
        message: 'Not authorized to view advances for this site'
      });
      return;
    }
    query.siteId = {
      $in: assignedSites
    };
  }

  const advanceEntries = await AdvanceEntry.find(query)
    .populate('workerId', 'name role')
    .populate('siteId', 'name')
    .populate('recordedBy', 'name role');

  res.json(advanceEntries);
});

// @desc    Update an advance entry
// @route   PUT /api/advances/:id
// @access  Private (Admin/Supervisor)
const updateAdvance = asyncHandler(async (req, res) => {
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
const deleteAdvance = asyncHandler(async (req, res) => {
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
  logAdvance,
  getAdvanceEntries,
  updateAdvance,
  deleteAdvance,
};
