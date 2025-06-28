const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Site = require('../models/Site');
const Worker = require('../models/Worker');
const AttendanceEntry = require('../models/AttendanceEntry');
const AdvanceEntry = require('../models/AdvanceEntry');
const MaterialEntry = require('../models/MaterialEntry');
const ActivityLog = require('../models/ActivityLog');
const SalaryLog = require('../models/SalaryLog');

// @desc    Get Admin Dashboard Summary
// @route   GET /api/admin/dashboard-summary
// @access  Private/Admin
const getAdminDashboardSummary = asyncHandler(async (req, res) => {
  const totalProjects = await Site.countDocuments();
  const totalWorkers = await Worker.countDocuments();
  const totalSupervisors = await User.countDocuments({
    role: 'supervisor'
  });

  // Example: Total material cost across all sites
  const totalMaterialCost = await MaterialEntry.aggregate([{
    $group: {
      _id: null,
      total: {
        $sum: '$total'
      }
    }
  }]);

  // Example: Recent activities
  const recentActivities = await ActivityLog.find({})
    .sort({
      date: -1
    })
    .limit(5)
    .populate('siteId', 'name')
    .populate('supervisorId', 'name');


  res.json({
    totalProjects,
    totalWorkers,
    totalSupervisors,
    totalMaterialCost: totalMaterialCost.length > 0 ? totalMaterialCost[0].total : 0,
    recentActivities,
  });
});


// @desc    Manage supervisor assignments to projects
// @route   PUT /api/admin/supervisors/:id/assign-sites
// @access  Private/Admin
const assignSitesToSupervisor = asyncHandler(async (req, res) => {
  const {
    siteIds
  } = req.body; // Array of site IDs
  const supervisorId = req.params.id;

  const supervisor = await User.findById(supervisorId);

  if (!supervisor) {
    res.status(404).json({
      message: 'Supervisor not found'
    });
    return;
  }

  if (supervisor.role !== 'supervisor') {
    res.status(400).json({
      message: 'User is not a supervisor'
    });
    return;
  }

  // Validate siteIds exist
  const existingSites = await Site.find({
    _id: {
      $in: siteIds
    }
  });
  if (existingSites.length !== siteIds.length) {
    res.status(400).json({
      message: 'One or more site IDs are invalid'
    });
    return;
  }

  supervisor.assignedSites = siteIds;
  await supervisor.save();

  // Update Site document's supervisors array as well
  // Remove supervisor from sites they are no longer assigned to
  await Site.updateMany({
    supervisors: supervisorId,
    _id: {
      $nin: siteIds
    }
  }, {
    $pull: {
      supervisors: supervisorId
    }
  });
  // Add supervisor to newly assigned sites
  await Site.updateMany({
    _id: {
      $in: siteIds
    },
    supervisors: {
      $ne: supervisorId
    }
  }, {
    $push: {
      supervisors: supervisorId
    }
  });

  res.json({
    message: 'Supervisor assigned to sites successfully',
    supervisor: supervisor
  });
});

module.exports = {
  getAdminDashboardSummary,
  assignSitesToSupervisor,
};