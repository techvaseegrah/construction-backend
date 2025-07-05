// construction/backend/controllers/activityController.js
const asyncHandler = require('express-async-handler');
const ActivityLog = require('../models/ActivityLog');
const Site = require('../models/Site');
const User = require('../models/User'); // Ensure User model is imported
const mongoose = require('mongoose');

// @desc    Log daily activity
// @route   POST /api/activities/log
// @access  Private (Supervisor/Admin)
const logActivity = asyncHandler(async (req, res) => {
  const {
    siteId,
    message,
    date
  } = req.body;

  const site = await Site.findById(siteId);
  if (!site) {
    res.status(404).json({
      message: 'Site not found'
    });
    return;
  }

  if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(siteId)) {
    res.status(403).json({
      message: 'Not authorized to log activity for this site'
    });
    return;
  }

  // Always use req.user._id directly for supervisorId.
  // The schema validation will ensure it's an ObjectId.
  // The issue with 'dev_admin_id' was fixed by ensuring it's converted to ObjectId
  // or by using actual users. For new logs, req.user._id should be fine.
  const supervisorId = req.user._id;

  const activityLog = await ActivityLog.create({
    siteId,
    supervisorId: supervisorId, // Use the actual user's ID
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

  console.log('--- getActivityLogs started ---');
  console.log('Received query params:', req.query);
  console.log('User Role:', req.user.role);

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
        res.status(403).json({ message: 'Not authorized to view activity logs for this site' });
        return;
      }
      query.siteId = siteId;
    } else {
      query.siteId = { $in: assignedSites };
    }
  } else if (siteId) {
    query.siteId = siteId;
  }

  console.log('Final Mongoose Query for Activity Logs:', JSON.stringify(query));

  const activityLogs = await ActivityLog.find(query)
    .populate('siteId', 'name')
    .populate('supervisorId', 'name role'); // MODIFIED: Populate role of supervisorId

  // MODIFIED: Map results to display 'Admin' if role is admin
  const formattedActivityLogs = activityLogs.map(log => ({
    ...log.toObject(), // Convert Mongoose document to plain object
    supervisorId: {
      name: log.supervisorId?.role === 'admin' ? 'Admin' : log.supervisorId?.name || 'N/A',
      role: log.supervisorId?.role || 'N/A'
    }
  }));

  res.json(formattedActivityLogs);
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
    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(activityLog.siteId.toString())) {
      res.status(403).json({ message: 'Not authorized to update activity log for this site' });
      return;
    }
    if (req.user.role !== 'admin' && activityLog.supervisorId.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to update this activity log' });
      return;
    }

    activityLog.message = message || activityLog.message;
    activityLog.date = date || activityLog.date;

    const updatedActivity = await activityLog.save();
    res.json(updatedActivity);
  } else {
    res.status(404).json({ message: 'Activity log not found' });
  }
});

// @desc    Delete an activity log
// @route   DELETE /api/activities/:id
// @access  Private (Admin/Supervisor)
const deleteActivity = asyncHandler(async (req, res) => {
  const activityLog = await ActivityLog.findById(req.params.id);

  if (activityLog) {
    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(activityLog.siteId.toString())) {
      res.status(403).json({ message: 'Not authorized to delete activity log for this site' });
      return;
    }
    if (req.user.role !== 'admin' && activityLog.supervisorId.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to delete this activity log' });
      return;
    }
    await activityLog.deleteOne();
    res.json({ message: 'Activity log removed' });
  } else {
    res.status(404).json({ message: 'Activity log not found' });
  }
});

module.exports = {
  logActivity,
  getActivityLogs,
  updateActivity,
  deleteActivity,
};