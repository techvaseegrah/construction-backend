const asyncHandler = require('express-async-handler');
const Site = require('../models/Site');
const AttendanceEntry = require('../models/AttendanceEntry');
const MaterialEntry = require('../models/MaterialEntry');
const ActivityLog = require('../models/ActivityLog');
const AdvanceEntry = require('../models/AdvanceEntry');
const Worker = require('../models/Worker'); // To check worker details like baseSalary

// @desc    Get Supervisor Dashboard Summary (based on assigned sites)
// @route   GET /api/supervisor/dashboard-summary
// @access  Private/Supervisor
const getSupervisorDashboardSummary = asyncHandler(async (req, res) => {
  const supervisorId = req.user._id;

  const assignedSites = await Site.find({
    supervisors: supervisorId
  }).select('_id name location');
  const siteIds = assignedSites.map(site => site._id);

  // Total workers assigned to these sites (could be complex if workers are assigned to multiple)
  let totalWorkers = 0;
  for (const site of assignedSites) {
    totalWorkers += site.assignedWorkers.length;
  }
  // This counts each assignment, not unique workers. For unique workers, you'd need aggregation.

  const recentActivities = await ActivityLog.find({
      siteId: {
        $in: siteIds
      }
    })
    .sort({
      date: -1
    })
    .limit(5)
    .populate('siteId', 'name');

  const recentMaterialLogs = await MaterialEntry.find({
      siteId: {
        $in: siteIds
      }
    })
    .sort({
      date: -1
    })
    .limit(5)
    .populate('siteId', 'name');

  res.json({
    assignedSites,
    totalWorkers,
    recentActivities,
    recentMaterialLogs,
  });
});

// @desc    Get all sites assigned to the current supervisor
// @route   GET /api/supervisor/my-sites
// @access  Private/Supervisor
const getMySites = asyncHandler(async (req, res) => {
  const supervisorId = req.user._id;
  const sites = await Site.find({
    supervisors: supervisorId
  }).populate('assignedWorkers.workerId', 'name role rfidId'); // Populate workers to show details
  res.json(sites);
});


module.exports = {
  getSupervisorDashboardSummary,
  getMySites,
};

