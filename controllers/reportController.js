const asyncHandler = require('express-async-handler');
const Site = require('../models/Site');
const Worker = require('../models/Worker');
const AttendanceEntry = require('../models/AttendanceEntry');
const AdvanceEntry = require('../models/AdvanceEntry');
const MaterialEntry = require('../models/MaterialEntry');
const ActivityLog = require('../models/ActivityLog');
const SalaryLog = require('../models/SalaryLog');
const mongoose = require('mongoose');
const {
  generatePdfReport
} = require('../utils/generatePdf'); // Assuming this exists

// Helper to calculate start and end of week (Sunday to Saturday)
const getWeekRange = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 for Sunday, 6 for Saturday
  const diff = d.getUTCDate() - day; // adjust when day is sunday
  const weekStart = new Date(d.setUTCDate(diff));
  const weekEnd = new Date(d.setUTCDate(diff + 6));
  weekEnd.setUTCHours(23, 59, 59, 999);
  return {
    weekStart,
    weekEnd
  };
};

// @desc    Generate a comprehensive report for a site or all sites
// @route   GET /api/reports/generate
// @access  Private (Admin/Supervisor)
const generateReport = asyncHandler(async (req, res) => {
  const {
    siteId,
    startDate,
    endDate,
    type = 'summary'
  } = req.query; // type could be 'summary', 'attendance', 'materials', 'salary', 'activity'

  let query = {};
  if (siteId) {
    query._id = siteId;
  }

  // If supervisor, restrict to their assigned sites
  if (req.user.role === 'supervisor') {
    const assignedSites = req.user.assignedSites;
    if (query._id && !assignedSites.includes(query._id.toString())) {
      res.status(403).json({
        message: 'Not authorized to generate reports for this site'
      });
      return;
    }
    query._id = {
      $in: assignedSites
    };
  }

  const sites = await Site.find(query).populate('supervisors', 'name').populate('assignedWorkers.workerId', 'name role baseSalary');
  if (sites.length === 0) {
    res.status(404).json({
      message: 'No sites found matching criteria'
    });
    return;
  }

  const reportData = [];

  for (const site of sites) {
    let siteReport = {
      siteName: site.name,
      siteLocation: site.location,
      startDate: site.startDate,
      supervisors: site.supervisors.map(s => s.name),
      summary: {},
      workers: [],
      materials: [],
      activities: [],
      salaryLogs: [],
      advances: [],
    };

    const dateQuery = {};
    if (startDate && endDate) {
      dateQuery.date = {
        $gte: new Date(startDate).setUTCHours(0, 0, 0, 0),
        $lte: new Date(endDate).setUTCHours(23, 59, 59, 999)
      };
    }

    // --- Site Summary ---
    const totalMaterialCost = await MaterialEntry.aggregate([{
      $match: {
        siteId: site._id,
        ...dateQuery
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: '$total'
        }
      }
    }, ]);
    siteReport.summary.totalMaterialCost = totalMaterialCost.length > 0 ? totalMaterialCost[0].total : 0;

    const totalAdvanceGiven = await AdvanceEntry.aggregate([{
      $match: {
        siteId: site._id,
        ...dateQuery
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: '$amount'
        }
      }
    }, ]);
    siteReport.summary.totalAdvanceGiven = totalAdvanceGiven.length > 0 ? totalAdvanceGiven[0].total : 0;

    // --- Worker Salaries (Calculate for the period, if not already logged in SalaryLogs) ---
    // If startDate and endDate are provided, calculate weekly salary for each week within the range
    // and log it if not present, then fetch.
    const allWorkersOnSite = await Worker.find({
      'assignedProjects.siteId': site._id
    });

    for (const worker of allWorkersOnSite) {
      const workerProjectAssignment = worker.assignedProjects.find(ap => ap.siteId.toString() === site._id.toString());
      const dailyRate = workerProjectAssignment && workerProjectAssignment.projectSalary ?
        workerProjectAssignment.projectSalary :
        worker.baseSalary;

      // Fetch all attendance for this worker on this site within the date range
      const attendanceForWorker = await AttendanceEntry.find({
        workerId: worker._id,
        siteId: site._id,
        ...dateQuery
      });

      const totalAttendanceDays = attendanceForWorker.reduce((sum, entry) => sum + entry.multiplier, 0);

      // Fetch advances for this worker on this site within the date range
      const advancesForWorker = await AdvanceEntry.find({
        workerId: worker._id,
        siteId: site._id,
        ...dateQuery
      });
      const totalAdvanceDeducted = advancesForWorker.reduce((sum, entry) => sum + entry.amount, 0);

      const grossSalary = totalAttendanceDays * dailyRate;
      const netSalary = grossSalary - totalAdvanceDeducted;

      siteReport.workers.push({
        workerId: worker._id,
        workerName: worker.name,
        workerRole: worker.role,
        dailyRate: dailyRate,
        totalAttendanceDays: totalAttendanceDays,
        grossSalary: grossSalary,
        totalAdvanceDeducted: totalAdvanceDeducted,
        netSalary: netSalary,
        attendanceDetails: attendanceForWorker.map(att => ({
          date: att.date,
          shiftType: att.shiftType,
          multiplier: att.multiplier
        })),
        advanceDetails: advancesForWorker.map(adv => ({
          date: adv.date,
          amount: adv.amount,
          reason: adv.reason
        }))
      });
    }

    // --- Material Cost ---
    siteReport.materials = await MaterialEntry.find({
      siteId: site._id,
      ...dateQuery
    }).populate('recordedBy', 'name');

    // --- Activity Logs ---
    siteReport.activities = await ActivityLog.find({
      siteId: site._id,
      ...dateQuery
    }).populate('supervisorId', 'name');

    // --- Salary Logs (already computed weekly salaries) ---
    siteReport.salaryLogs = await SalaryLog.find({
      siteId: site._id,
      weekStart: dateQuery.date ? dateQuery.date.$gte : {
        $exists: true
      },
      weekEnd: dateQuery.date ? dateQuery.date.$lte : {
        $exists: true
      },
    }).populate('workerId', 'name role');

    // --- Advance Logs ---
    siteReport.advances = await AdvanceEntry.find({
      siteId: site._id,
      ...dateQuery
    }).populate('workerId', 'name').populate('recordedBy', 'name');


    reportData.push(siteReport);
  }

  // Determine output format
  if (req.query.format === 'pdf') {
    // Generate PDF (assuming generatePdfReport handles this)
    const pdfBuffer = await generatePdfReport(reportData); // This function needs to be implemented
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=contractor_report.pdf');
    res.send(pdfBuffer);
  } else if (req.query.format === 'excel') {
    // Generate Excel (needs a library like 'exceljs' or 'json2csv')
    // For simplicity, we'll return JSON for now and mention excel generation
    res.status(501).json({
      message: 'Excel export not yet implemented. Please try PDF or JSON.',
      reportData
    });
  } else {
    res.json(reportData);
  }
});


// @desc    Calculate and log weekly salaries (can be run via cron or manually by admin)
// @route   POST /api/reports/calculate-weekly-salaries
// @access  Private (Admin only)
const calculateAndLogWeeklySalaries = asyncHandler(async (req, res) => {
  const {
    date
  } = req.body; // Date within the week to calculate for
  const calculationDate = date ? new Date(date) : new Date();

  const {
    weekStart,
    weekEnd
  } = getWeekRange(calculationDate);

  const workers = await Worker.find({}); // Get all workers
  const sites = await Site.find({}); // Get all sites

  const newSalaryLogs = [];

  for (const worker of workers) {
    for (const assignedProject of worker.assignedProjects) {
      const siteId = assignedProject.siteId;
      const siteName = assignedProject.siteName;
      const projectSalaryOverride = assignedProject.projectSalary;

      const dailyRate = projectSalaryOverride || worker.baseSalary;

      // Get attendance for the week for this worker on this site
      const attendanceThisWeek = await AttendanceEntry.find({
        workerId: worker._id,
        siteId: siteId,
        date: {
          $gte: weekStart,
          $lte: weekEnd
        }
      });

      if (attendanceThisWeek.length === 0) {
        continue; // No attendance for this worker on this site this week
      }

      const totalAttendanceDays = attendanceThisWeek.reduce((sum, entry) => sum + entry.multiplier, 0);
      const grossSalary = totalAttendanceDays * dailyRate;

      // Get advances for the week for this worker on this site
      const advancesThisWeek = await AdvanceEntry.find({
        workerId: worker._id,
        siteId: siteId,
        date: {
          $gte: weekStart,
          $lte: weekEnd
        }
      });
      const totalAdvanceDeducted = advancesThisWeek.reduce((sum, entry) => sum + entry.amount, 0);

      const netSalary = grossSalary - totalAdvanceDeducted;

      // Check if a salary log for this worker, site, and week already exists
      const existingSalaryLog = await SalaryLog.findOne({
        workerId: worker._id,
        siteId: siteId,
        weekStart: weekStart,
        weekEnd: weekEnd,
      });

      if (existingSalaryLog) {
        // Update existing log
        existingSalaryLog.totalAttendanceDays = totalAttendanceDays;
        existingSalaryLog.shiftDetails = attendanceThisWeek.map(att => ({
          date: att.date,
          shiftType: att.shiftType,
          multiplier: att.multiplier
        }));
        existingSalaryLog.dailyRateUsed = dailyRate;
        existingSalaryLog.grossSalary = grossSalary;
        existingSalaryLog.totalAdvanceDeducted = totalAdvanceDeducted;
        existingSalaryLog.netSalary = netSalary;
        await existingSalaryLog.save();
        newSalaryLogs.push(existingSalaryLog);
      } else {
        // Create new salary log
        const salaryLog = await SalaryLog.create({
          workerId: worker._id,
          siteId: siteId,
          weekStart: weekStart,
          weekEnd: weekEnd,
          totalAttendanceDays: totalAttendanceDays,
          shiftDetails: attendanceThisWeek.map(att => ({
            date: att.date,
            shiftType: att.shiftType,
            multiplier: att.multiplier
          })),
          dailyRateUsed: dailyRate,
          grossSalary: grossSalary,
          totalAdvanceDeducted: totalAdvanceDeducted,
          netSalary: netSalary,
        });
        newSalaryLogs.push(salaryLog);
      }
    }
  }

  res.json({
    message: `Weekly salaries calculated and logged/updated for the week ${weekStart.toISOString().split('T')[0]} - ${weekEnd.toISOString().split('T')[0]}`,
    loggedSalaries: newSalaryLogs,
  });
});

module.exports = {
  generateReport,
  calculateAndLogWeeklySalaries,
};