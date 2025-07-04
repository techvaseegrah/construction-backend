// construction/backend/controllers/adminController.js
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Site = require('../models/Site');
const Worker = require('../models/Worker');
const AttendanceEntry = require('../models/AttendanceEntry');
const AdvanceEntry = require('../models/AdvanceEntry');
const MaterialEntry = require('../models/MaterialEntry');
const ActivityLog = require('../models/ActivityLog');
const SalaryLog = require('../models/SalaryLog');
const mongoose = require('mongoose');

// @desc    Get Admin Dashboard Overall Summary
// @route   GET /api/admin/dashboard-summary
// @access  Private/Admin
const getAdminDashboardSummary = asyncHandler(async (req, res) => {
  const totalProjects = await Site.countDocuments();
  const totalWorkers = await Worker.countDocuments();

  // NEW: Fetch detailed list of supervisors
  const supervisorsList = await User.find({ role: 'supervisor' })
    .select('name username email assignedSites') // Select relevant fields
    .populate('assignedSites', 'name'); // Populate assigned site names
  const totalSupervisors = supervisorsList.length; // Count from the fetched list

  const totalMaterialCostResult = await MaterialEntry.aggregate([{
    $group: {
      _id: null,
      total: {
        $sum: '$total'
      }
    }
  }]);
  const totalMaterialCost = totalMaterialCostResult.length > 0 ? totalMaterialCostResult[0].total : 0;

  const totalSalaryCostResult = await SalaryLog.aggregate([{
    $group: {
      _id: null,
      total: {
        $sum: '$netSalary'
      }
    }
  }]);
  const totalSalaryCost = totalSalaryCostResult.length > 0 ? totalSalaryCostResult[0].total : 0;

  const overallTotalCost = totalMaterialCost + totalSalaryCost;

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
    supervisorsList, // NEW: Include the detailed list of supervisors in the response
    totalMaterialCost,
    totalSalaryCost,
    overallTotalCost,
    recentActivities,
  });
});


// @desc    Get Admin Dashboard Project-wise Summaries
// @route   GET /api/admin/project-summaries
// @access  Private/Admin
const getAdminProjectSummaries = asyncHandler(async (req, res) => {
    // Get all sites (projects)
    const projects = await Site.find({}).select('_id name location startDate');

    const projectSummaries = [];

    for (const project of projects) {
        // Count workers assigned to this project
        const workersAssignedCount = await Worker.countDocuments({
            'assignedProjects.siteId': project._id
        });

        // Calculate total material cost for this project
        const projectMaterialCostResult = await MaterialEntry.aggregate([
            { $match: { siteId: project._id } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);
        const projectMaterialCost = projectMaterialCostResult.length > 0 ? projectMaterialCostResult[0].total : 0;

        // Calculate total salary cost for this project
        const projectSalaryCostResult = await SalaryLog.aggregate([
            { $match: { siteId: project._id } },
            { $group: { _id: null, total: { $sum: '$netSalary' } } }
        ]);
        const projectSalaryCost = projectSalaryCostResult.length > 0 ? projectSalaryCostResult[0].total : 0;

        // Calculate overall cost for this project
        const projectOverallCost = projectMaterialCost + projectSalaryCost;

        projectSummaries.push({
            _id: project._id,
            name: project.name,
            location: project.location,
            startDate: project.startDate,
            totalWorkers: workersAssignedCount,
            totalMaterialCost: projectMaterialCost,
            totalSalaryCost: projectSalaryCost,
            overallCost: projectOverallCost,
        });
    }

    res.json(projectSummaries);
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
  getAdminProjectSummaries,
  assignSitesToSupervisor,
};