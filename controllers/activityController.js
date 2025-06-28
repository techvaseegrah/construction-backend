const asyncHandler = require('express-async-handler');
const ActivityLog = require('../models/ActivityLog');
const Site = require('../models/Site');
const User = require('../models/User');

// @desc    Log daily activity
// @route   POST /api/activities/log
// @access  Private (Supervisor/Admin)
const logActivity = asyncHandler(async (req, res) => {
  const {
    siteId,
    message,
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
      message: 'Not authorized to log activity for this site'
    });
    return;
  }

  const activityLog = await ActivityLog.create({
    siteId,
    supervisorId: req.user._id,
    date: date || Date.now(),
    message,
  });

  res.status(201).json(activityLog);
});

// @desc    Get activity logs (filtered by site, date range)
// @route   GET /api/activities
// @access  Private (Admin/Supervisor)
const getActivityLogs = asyncHandler(async (req, res) => {
  const {
    siteId,
    startDate,
    endDate
  } = req.query;
  let query = {};

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
        message: 'Not authorized to view activity logs for this site'
      });
      return;
    }
    query.siteId = {
      $in: assignedSites
    };
  }

  const activityLogs = await ActivityLog.find(query)
    .populate('siteId', 'name')
    .populate('supervisorId', 'name');

  res.json(activityLogs);
});

// @desc    Update an activity log
// @route   PUT /api/activities/:id
// @access  Private (Admin/Supervisor)
const updateActivity = asyncHandler(async (req, res) => {
  const {
    message,
    date
  } = req.body;

  const activityLog = await ActivityLog.findById(req.params.id);

  if (activityLog) {
    // Ensure supervisor is authorized for this site
    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(activityLog.siteId.toString())) {
      res.status(403).json({
        message: 'Not authorized to update activity log for this site'
      });
      return;
    }
    // Only the supervisor who logged it or an admin can update it
    if (req.user.role !== 'admin' && activityLog.supervisorId.toString() !== req.user._id.toString()) {
      res.status(403).json({
        message: 'Not authorized to update this activity log'
      });
      return;
    }

    activityLog.message = message || activityLog.message;
    activityLog.date = date || activityLog.date;

    const updatedActivity = await activityLog.save();
    res.json(updatedActivity);
  } else {
    res.status(404).json({
      message: 'Activity log not found'
    });
  }
});

// @desc    Delete an activity log
// @route   DELETE /api/activities/:id
// @access  Private (Admin/Supervisor)
const deleteActivity = asyncHandler(async (req, res) => {
  const activityLog = await ActivityLog.findById(req.params.id);

  if (activityLog) {
    // Ensure supervisor is authorized for this site
    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(activityLog.siteId.toString())) {
      res.status(403).json({
        message: 'Not authorized to delete activity log for this site'
      });
      return;
    }
    // Only the supervisor who logged it or an admin can delete it
    if (req.user.role !== 'admin' && activityLog.supervisorId.toString() !== req.user._id.toString()) {
      res.status(403).json({
        message: 'Not authorized to delete this activity log'
      });
      return;
    }
    await activityLog.deleteOne();
    res.json({
      message: 'Activity log removed'
    });
  } else {
    res.status(404).json({
      message: 'Activity log not found'
    });
  }
});

module.exports = {
  logActivity,
  getActivityLogs,
  updateActivity,
  deleteActivity,
};