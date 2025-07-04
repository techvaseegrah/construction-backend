// construction/backend/controllers/supervisorController.js
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Site = require('../models/Site');
const Worker = require('../models/Worker');
const AttendanceEntry = require('../models/AttendanceEntry');
const MaterialEntry = require('../models/MaterialEntry');
const ActivityLog = require('../models/ActivityLog');
const AdvanceEntry = require('../models/AdvanceEntry');
const SalaryLog = require('../models/SalaryLog');
const mongoose = require('mongoose');

// @desc    Get Supervisor Dashboard Summary
// @route   GET /api/supervisor/dashboard-summary
// @access  Private/Supervisor
const getSupervisorDashboardSummary = asyncHandler(async (req, res) => {
  const supervisorId = req.user._id;
  const assignedSitesIds = req.user.assignedSites; // These are Mongoose ObjectIds

  // Fetch assigned sites with populated workers
  const assignedSites = await Site.find({ _id: { $in: assignedSitesIds } })
    .populate('assignedWorkers.workerId', 'name role rfidId');

  const totalAssignedSites = assignedSites.length;

  let totalWorkersAcrossAssignedSites = 0;
  let allAssignedWorkersList = []; // NEW: To store unique workers for breakdown
  assignedSites.forEach(site => {
    totalWorkersAcrossAssignedSites += site.assignedWorkers.length;
    site.assignedWorkers.forEach(workerAssignment => {
      // Add worker to list if not already present (to get unique workers)
      if (!allAssignedWorkersList.some(w => w._id.toString() === workerAssignment.workerId._id.toString())) {
        allAssignedWorkersList.push({
          _id: workerAssignment.workerId._id,
          name: workerAssignment.workerId.name,
          role: workerAssignment.workerId.role,
          // Add site name for context in breakdown
          assignedSites: [site.name]
        });
      } else {
        // If worker already in list, add current site to their assignedSites
        const existingWorker = allAssignedWorkersList.find(w => w._id.toString() === workerAssignment.workerId._id.toString());
        if (existingWorker && !existingWorker.assignedSites.includes(site.name)) {
          existingWorker.assignedSites.push(site.name);
        }
      }
    });
  });

  // Aggregate total material cost across assigned sites
  const totalMaterialCostResult = await MaterialEntry.aggregate([
    { $match: { siteId: { $in: assignedSitesIds } } },
    { $group: { _id: null, total: { $sum: '$total' } } }
  ]);
  const totalMaterialCost = totalMaterialCostResult.length > 0 ? totalMaterialCostResult[0].total : 0;

  // Aggregate total advance given across assigned sites
  const totalAdvanceGivenResult = await AdvanceEntry.aggregate([
    { $match: { siteId: { $in: assignedSitesIds } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const totalAdvanceGiven = totalAdvanceGivenResult.length > 0 ? totalAdvanceGivenResult[0].total : 0;

  // Recent activities for assigned sites
  const recentActivities = await ActivityLog.find({ siteId: { $in: assignedSitesIds } })
    .sort({ date: -1 })
    .limit(5)
    .populate('siteId', 'name')
    .populate('supervisorId', 'name');

  res.json({
    totalAssignedSites,
    totalWorkersAcrossAssignedSites,
    totalMaterialCost,
    totalAdvanceGiven,
    recentActivities,
    // NEW: Include lists for breakdowns
    allAssignedWorkersList, // List of unique workers across all assigned sites
    assignedSitesList: assignedSites.map(site => ({ // List of assigned sites with basic info
      _id: site._id,
      name: site.name,
      location: site.location,
      startDate: site.startDate,
      totalWorkers: site.assignedWorkers.length // Workers count for this specific site
    }))
  });
});

// @desc    Get Supervisor Dashboard Site-wise Summaries
// @route   GET /api/supervisor/site-summaries
// @access  Private/Supervisor
const getSupervisorSiteSummaries = asyncHandler(async (req, res) => {
    const supervisorId = req.user._id;
    const assignedSitesIds = req.user.assignedSites;

    // Fetch only sites assigned to the current supervisor
    const sites = await Site.find({ _id: { $in: assignedSitesIds } })
        .select('_id name location startDate'); // Select basic site info

    const siteSummaries = [];

    for (const site of sites) {
        // Count workers assigned to this specific site
        const workersAssignedCount = await Worker.countDocuments({
            'assignedProjects.siteId': site._id
        });

        // Calculate total material cost for this specific site
        const siteMaterialCostResult = await MaterialEntry.aggregate([
            { $match: { siteId: site._id } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);
        const siteMaterialCost = siteMaterialCostResult.length > 0 ? siteMaterialCostResult[0].total : 0;

        // Calculate total advance given for this specific site
        const siteAdvanceGivenResult = await AdvanceEntry.aggregate([
            { $match: { siteId: site._id } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const siteAdvanceGiven = siteAdvanceGivenResult.length > 0 ? siteAdvanceGivenResult[0].total : 0;

        // Note: Supervisor dashboard doesn't currently show total salary cost or overall cost.
        // If these are needed per site, you'd calculate them here similar to adminController.
        // For now, only material cost and advances are common summary metrics for supervisor.

        siteSummaries.push({
            _id: site._id,
            name: site.name,
            location: site.location,
            startDate: site.startDate,
            totalWorkers: workersAssignedCount,
            totalMaterialCost: siteMaterialCost,
            totalAdvanceGiven: siteAdvanceGiven,
            // Add other site-specific metrics here if needed
        });
    }

    res.json(siteSummaries);
});


// @desc    Get supervisor's assigned sites
// @route   GET /api/supervisor/my-sites
// @access  Private/Supervisor
const getMySites = asyncHandler(async (req, res) => {
  const assignedSites = await Site.find({
      supervisors: req.user._id
    })
    .populate('supervisors', 'name username')
    .populate('assignedWorkers.workerId', 'name role rfidId');
  res.json(assignedSites);
});


module.exports = {
  getSupervisorDashboardSummary,
  getSupervisorSiteSummaries, // NEW: Export the new function
  getMySites,
};