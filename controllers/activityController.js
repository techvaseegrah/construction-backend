// construction/backend/controllers/activityController.js
const asyncHandler = require('express-async-handler');
const ActivityLog = require('../models/ActivityLog');
const Site = require('../models/Site');
const User = require('../models/User');
const mongoose = require('mongoose'); // Import mongoose to use mongoose.Types.ObjectId

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

  // Determine supervisorId: Use actual user ID if it's a valid ObjectId,
  // otherwise, use a placeholder ObjectId for dev users to pass validation.
  let actualSupervisorId;
  if (req.user._id === 'dev_admin_id' || req.user._id === 'dev_supervisor_id') {
      actualSupervisorId = new mongoose.Types.ObjectId('60a7b1b3c9f2b1001a4e2d3e'); // A static dummy ObjectId
  } else {
      actualSupervisorId = req.user._id; // Use the actual user's ObjectId
  }

  const activityLog = await ActivityLog.create({
    siteId,
    supervisorId: actualSupervisorId, // Use the determined ID
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
    siteId, // This comes from the frontend, for the currently selected project
    startDate,
    endDate
  } = req.query;
  let query = {};

  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate).setUTCHours(0, 0, 0, 0),
      $lte: new Date(endDate).setUTCHours(23, 59, 59, 999)
    };
  }

  // Apply site filtering based on user role and provided siteId
  if (req.user.role === 'supervisor') {
    const assignedSites = req.user.assignedSites.map(id => id.toString()); // Ensure string comparison

    if (siteId) {
      // If specific siteId is requested, ensure supervisor is authorized for it
      if (!assignedSites.includes(siteId)) {
        res.status(403).json({ message: 'Not authorized to view activity logs for this site' });
        return;
      }
      query.siteId = siteId; // Apply the specific siteId filter
    } else {
      // If no specific siteId is requested, show all assigned sites for this supervisor
      query.siteId = { $in: assignedSites };
    }
  } else if (siteId) {
    // If user is ADMIN and a specific siteId is requested, apply that siteId filter
    // Admins have access to all sites, so no authorization check is needed here, just the filter application.
    query.siteId = siteId;
  }
  // If Admin and no siteId is provided, query.siteId remains undefined, meaning fetch all activities (admin's default view)


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