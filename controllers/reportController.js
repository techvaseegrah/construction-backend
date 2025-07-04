// construction/backend/controllers/reportController.js
const asyncHandler = require('express-async-handler');
const Site = require('../models/Site');
const AttendanceEntry = require('../models/AttendanceEntry');
const MaterialEntry = require('../models/MaterialEntry');
const ActivityLog = require('../models/ActivityLog');
const AdvanceEntry = require('../models/AdvanceEntry');
const SalaryLog = require('../models/SalaryLog');
const User = require('../models/User');
const Worker = require('../models/Worker');
const { generatePdfReport } = require('../utils/generatePdf');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');

// Helper to get total multiplier (attendance days) for a worker in a date range
const getWorkerAttendanceSummary = async (workerId, siteId, startDate, endDate) => {
  const matchQuery = {
    workerId: new mongoose.Types.ObjectId(workerId),
    siteId: new mongoose.Types.ObjectId(siteId),
    date: { $gte: startDate, $lte: endDate }
  };
  const result = await AttendanceEntry.aggregate([
    { $match: matchQuery },
    { $group: { _id: null, totalMultiplier: { $sum: '$multiplier' } } }
  ]);
  return result.length > 0 ? result[0].totalMultiplier : 0;
};


// @desc    Generate a report
// @route   GET /api/reports/generate
// @access  Private (Admin/Supervisor)
const generateReport = asyncHandler(async (req, res) => {
  const { siteId, startDate, endDate, format } = req.query;

  console.log('--- generateReport started ---');
  console.log('Received siteId:', siteId, 'startDate:', startDate, 'endDate:', endDate, 'format:', format);

  let querySiteId = siteId;

  if (req.user.role === 'supervisor') {
    const assignedSites = req.user.assignedSites.map(id => id.toString());
    console.log('Supervisor assigned sites:', assignedSites);

    if (querySiteId) {
      if (!assignedSites.includes(querySiteId)) {
        console.log('Supervisor NOT authorized for requested siteId:', querySiteId);
        res.status(403).json({ message: 'Not authorized to generate report for this site' });
        return;
      }
      querySiteId = querySiteId;
      console.log('Supervisor authorized for specific siteId:', querySiteId);
    } else {
      querySiteId = { $in: assignedSites };
      console.log('Supervisor generating report for all assigned sites:', querySiteId);
    }
  } else {
      console.log('User is Admin. Querying with siteId:', querySiteId || 'all sites');
  }

  const reportStartDate = startDate ? new Date(startDate) : new Date('1970-01-01T00:00:00.000Z');
  const reportEndDate = endDate ? new Date(new Date(endDate).setUTCHours(23, 59, 59, 999)) : new Date();

  if (isNaN(reportStartDate.getTime()) || isNaN(reportEndDate.getTime())) {
    console.error('Invalid date received. Start:', startDate, 'End:', endDate);
    res.status(400).json({ message: 'Invalid start or end date.' });
    return;
  }
  console.log('Report Date Range:', reportStartDate.toISOString(), 'to', reportEndDate.toISOString());


  let siteQuery = {};
  if (querySiteId) {
    if (typeof querySiteId === 'string') {
      siteQuery._id = new mongoose.Types.ObjectId(querySiteId);
    } else if (typeof querySiteId === 'object' && querySiteId.$in) {
      siteQuery._id = { $in: querySiteId.$in.map(id => new mongoose.Types.ObjectId(id)) };
    }
  }
  console.log('Final Site Query:', JSON.stringify(siteQuery));

  const sites = await Site.find(siteQuery)
    .populate('assignedWorkers.workerId', 'name role rfidId baseSalary assignedProjects')
    .populate('supervisors', 'name');

  if (sites.length === 0) {
    console.log('No sites found for query:', JSON.stringify(siteQuery));
    res.status(404).json({ message: 'No sites found matching criteria or you are not authorized.' });
    return;
  }
  console.log('Found sites:', sites.map(s => s.name));

  const finalReportData = [];

  for (const site of sites) {
    console.log('Processing site:', site.name);
    const siteReport = {
      siteName: site.name,
      siteLocation: site.location,
      startDate: site.startDate,
      supervisors: site.supervisors.map(s => s.name),
      totalWorkersAssigned: site.assignedWorkers.length,
      attendanceSummary: [],
      materialSummary: [],
      activityLogs: [],
      advanceLogs: [],
      salaryCalculations: [],
    };

    console.log('Fetching raw material logs for site:', site.name);
    const materials = await MaterialEntry.find({
      siteId: site._id,
      date: { $gte: reportStartDate, $lte: reportEndDate }
    }).populate('recordedBy', 'name');
    siteReport.materialSummary = materials.map(m => ({
      material: m.material,
      brand: m.brand,
      quantity: m.quantity,
      unit: m.unit,
      pricePerUnit: m.pricePerUnit,
      totalCost: m.total,
      date: m.date,
      recordedBy: m.recordedBy
    }));
    const totalMaterialCost = materials.reduce((sum, m) => sum + m.total, 0);
    console.log('Material Summary collected.');


    console.log('Fetching advance logs for site:', site.name);
    const advances = await AdvanceEntry.find({
      siteId: site._id,
      date: { $gte: reportStartDate, $lte: reportEndDate }
    }).populate('workerId', 'name role').populate('recordedBy', 'name');
    siteReport.advanceLogs = advances.map(a => ({
      workerId: a.workerId,
      amount: a.amount,
      date: a.date,
      reason: a.reason,
      recordedBy: a.recordedBy
    }));
    const totalAdvanceGiven = advances.reduce((sum, a) => sum + a.amount, 0);
    console.log('Advance Logs collected.');

    siteReport.summary = {
        totalMaterialCost: totalMaterialCost,
        totalAdvanceGiven: totalAdvanceGiven,
    };
    console.log('Overall Site Summary collected.');

    console.log('Fetching attendance and calculating salaries for site:', site.name);
    for (const workerAssignment of site.assignedWorkers) {
        if (!workerAssignment.workerId) {
            console.warn(`Worker ID missing for assignment in site ${site.name}:`, workerAssignment);
            continue;
        }
        const worker = workerAssignment.workerId;
        const totalAttendanceDays = await getWorkerAttendanceSummary(
            worker._id,
            site._id,
            reportStartDate,
            reportEndDate
        );

        const workerSpecificAdvance = siteReport.advanceLogs.filter(adv =>
            adv.workerId?._id.toString() === worker._id.toString()
        ).reduce((sum, adv) => sum + adv.amount, 0);

        const dailyRateUsed = workerAssignment.salaryOverride || worker.baseSalary || 0;
        const grossSalary = totalAttendanceDays * dailyRateUsed;
        const netSalary = grossSalary - workerSpecificAdvance;

        siteReport.salaryCalculations.push({
            workerName: worker.name,
            workerRole: worker.role,
            rfidId: worker.rfidId,
            totalAttendanceDays: totalAttendanceDays,
            dailyRateUsed: dailyRateUsed,
            grossSalary: grossSalary,
            totalAdvance: workerSpecificAdvance,
            netSalary: netSalary,
            workerId: worker._id
        });
    }
    console.log('Salary calculations complete for site:', site.name);

    console.log('Fetching activity logs for site:', site.name);
    const activities = await ActivityLog.find({
      siteId: site._id,
      date: { $gte: reportStartDate, $lte: reportEndDate }
    }).populate('supervisorId', 'name');
    siteReport.activityLogs = activities.map(a => ({
      date: a.date,
      message: a.message,
      supervisorId: a.supervisorId
    }));
    console.log('Activity Logs collected.');

    finalReportData.push(siteReport);
    console.log('Finished processing site:', site.name);
  }

  console.log('All report data compiled. Format:', format);

  if (format === 'pdf') {
    try {
      console.log('Attempting PDF generation...');
      const pdfBuffer = await generatePdfReport(finalReportData);
      console.log('PDF generation successful.');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=report_${siteId || 'all_sites'}_${reportStartDate.toISOString().slice(0,10)}.pdf`);
      res.send(pdfBuffer);
    } catch (pdfError) {
      console.error('Error during PDF generation:', pdfError);
      console.error('PDF Error Stack:', pdfError.stack);
      res.status(500).json({ message: 'Error generating PDF report.', error: pdfError.message });
    }
  } else if (format === 'excel') {
    try {
        const workbook = new ExcelJS.Workbook();
        finalReportData.forEach((siteReport) => {
          const sheet = workbook.addWorksheet(`${siteReport.siteName}`);
          sheet.addRow(['Report for Site:', siteReport.siteName]);
          sheet.addRow(['Location:', siteReport.siteLocation]);
          sheet.addRow(['Start Date:', siteReport.startDate.toLocaleDateString()]);
          sheet.addRow(['Supervisors:', siteReport.supervisors.join(', ')]);
          sheet.addRow(['Total Workers Assigned:', siteReport.totalWorkersAssigned]);
          sheet.addRow([]);

          sheet.addRow(['Overall Summary']);
          sheet.addRow(['Total Material Cost', 'Total Advance Given']);
          sheet.addRow([`₹${siteReport.summary.totalMaterialCost.toFixed(2)}`, `₹${siteReport.summary.totalAdvanceGiven.toFixed(2)}`]);
          sheet.addRow([]);

          sheet.addRow(['Worker Salary Calculations']);
          sheet.addRow(['Worker Name', 'Role', 'RFID ID', 'Total Attendance Days', 'Daily Rate Used', 'Gross Salary', 'Total Advance', 'Net Salary']);
          siteReport.salaryCalculations.forEach(sal => {
            sheet.addRow([
              sal.workerName,
              sal.workerRole,
              sal.rfidId,
              sal.totalAttendanceDays,
              `₹${sal.dailyRateUsed.toFixed(2)}`,
              `₹${sal.grossSalary.toFixed(2)}`,
              `₹${sal.totalAdvance.toFixed(2)}`,
              `₹${sal.netSalary.toFixed(2)}`
            ]);
          });
          sheet.addRow([]);

          sheet.addRow(['Material Summary']);
          sheet.addRow(['Material', 'Brand', 'Quantity', 'Unit', 'Price/Unit', 'Total Cost', 'Date', 'Recorded By']);
          siteReport.materialSummary.forEach(mat => {
            sheet.addRow([mat.material, mat.brand, mat.quantity, mat.unit, `₹${mat.pricePerUnit.toFixed(2)}`, `₹${mat.totalCost.toFixed(2)}`, mat.date.toLocaleDateString(), mat.recordedBy?.name || 'N/A']);
          });
          sheet.addRow([]);

          sheet.addRow(['Activity Logs']);
          sheet.addRow(['Date', 'Message', 'Supervisor']);
          siteReport.activityLogs.forEach(act => {
            sheet.addRow([act.date.toLocaleDateString(), act.message, act.supervisorId?.name || 'N/A']);
          });
          sheet.addRow([]);

          sheet.addRow(['Advance Logs']);
          sheet.addRow(['Worker Name', 'Amount', 'Date', 'Reason', 'Recorded By']);
          siteReport.advanceLogs.forEach(adv => {
            sheet.addRow([adv.workerId?.name || 'N/A', `₹${adv.amount.toFixed(2)}`, adv.date.toLocaleDateString(), adv.reason, adv.recordedBy?.name || 'N/A']);
          });
          sheet.addRow([]);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=report_${siteId || 'all_sites'}_${reportStartDate.toISOString().slice(0,10)}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
        console.log('Excel generation successful.');
    } catch (excelError) {
        console.error('Error during Excel generation:', excelError);
        console.error('Excel Error Stack:', excelError.stack);
        res.status(500).json({ message: 'Error generating Excel report.', error: excelError.message });
    }
  } else {
    res.json({ message: 'Report generated successfully!', reportData: finalReportData });
    console.log('JSON report generated.');
  }
});

// @desc    Calculate and log weekly salaries for all workers across all sites
// @route   POST /api/reports/calculate-weekly-salaries
// @access  Private (Admin only)
const calculateAndLogWeeklySalaries = asyncHandler(async (req, res) => {
  const { startDate, endDate, siteId } = req.body;

  if (!startDate || !endDate) {
    res.status(400).json({ message: 'Start date and end date are required for salary calculation.' });
    return;
  }

  const startOfWeek = new Date(startDate);
  startOfWeek.setUTCHours(0, 0, 0, 0);
  const endOfWeek = new Date(endDate);
  endOfWeek.setUTCHours(23, 59, 59, 999);

  let siteQuery = {};
  if (siteId) {
    siteQuery._id = new mongoose.Types.ObjectId(siteId);
  }

  const sites = await Site.find(siteQuery)
    .populate('assignedWorkers.workerId', 'name baseSalary assignedProjects');

  if (sites.length === 0) {
    res.status(404).json({ message: 'No sites found for salary calculation.' });
    return;
  }

  const salaryLogsToSave = [];
  const calculatedSalaries = [];

  let recordedById;
  if (req.user._id === 'dev_admin_id' || req.user._id === 'dev_supervisor_id') {
      recordedById = new mongoose.Types.ObjectId('60a7b1b3c9f2b1001a4e2d3c');
  } else {
      recordedById = req.user._id;
  }


  for (const site of sites) {
    for (const workerAssignment of site.assignedWorkers) {
      const worker = workerAssignment.workerId;
      if (!worker) continue;

      const totalAttendanceDays = await getWorkerAttendanceSummary(
        worker._id,
        site._id,
        startOfWeek,
        endOfWeek
      );

      const workerAdvances = await AdvanceEntry.find({
        workerId: worker._id,
        siteId: site._id,
        date: { $gte: startOfWeek, $lte: endOfWeek }
      });
      const totalAdvanceDeducted = workerAdvances.reduce((sum, adv) => sum + adv.amount, 0);

      const dailyRate = workerAssignment.salaryOverride || worker.baseSalary || 0;
      const grossSalary = totalAttendanceDays * dailyRate;
      const netSalary = grossSalary - totalAdvanceDeducted;

      // Check if a salary log already exists for this worker, site, and week
      const existingLog = await SalaryLog.findOne({
          workerId: worker._id,
          siteId: site._id,
          weekStart: startOfWeek,
          weekEnd: endOfWeek
      });

      if (existingLog) {
          // If it exists, update it instead of creating a duplicate
          existingLog.totalAttendanceDays = totalAttendanceDays;
          existingLog.dailyRateUsed = dailyRate;
          existingLog.grossSalary = grossSalary;
          existingLog.totalAdvanceDeducted = totalAdvanceDeducted;
          existingLog.netSalary = netSalary;
          // Only update recordedBy if it's currently null or if it's a dev user
          if (!existingLog.recordedBy || existingLog.recordedBy.toString() === '60a7b1b3c9f2b1001a4e2d3c') {
              existingLog.recordedBy = recordedById;
          }
          await existingLog.save();
          console.log(`Updated existing salary log for worker ${worker.name} at site ${site.name} for week ${startOfWeek.toLocaleDateString()}`);
      } else {
          // Create new log if it doesn't exist
          salaryLogsToSave.push({
            workerId: worker._id,
            siteId: site._id,
            weekStart: startOfWeek,
            weekEnd: endOfWeek,
            totalAttendanceDays: totalAttendanceDays,
            dailyRateUsed: dailyRate,
            grossSalary: grossSalary,
            totalAdvanceDeducted: totalAdvanceDeducted,
            netSalary: netSalary,
            paid: false,
            paymentDate: null,
            recordedBy: recordedById,
          });
      }

      calculatedSalaries.push({
        workerName: worker.name,
        siteName: site.name,
        weekStart: startOfWeek.toLocaleDateString(),
        weekEnd: endOfWeek.toLocaleDateString(),
        attendanceDays: totalAttendanceDays,
        grossSalary: grossSalary,
        advanceDeducted: totalAdvanceDeducted,
        netSalary: netSalary,
        paid: existingLog ? existingLog.paid : false // Retain paid status if updating existing
      });
    }
  }

  // Only create new logs that were pushed to salaryLogsToSave
  if (salaryLogsToSave.length > 0) {
    await SalaryLog.insertMany(salaryLogsToSave); // Use insertMany for efficiency
  }

  res.status(200).json({
    message: 'Weekly salaries calculated and logged successfully.',
    calculatedSalaries: calculatedSalaries
  });
});


// @desc    Get Salary Logs (for Admin/Supervisor)
// @route   GET /api/reports/salary-logs
// @access  Private (Admin/Supervisor)
const getSalaryLogs = asyncHandler(async (req, res) => {
  const { siteId, workerId, startDate, endDate, paidStatus } = req.query;
  let query = {};

  if (siteId) {
    query.siteId = siteId;
  }
  if (workerId) {
    query.workerId = workerId;
  }
  if (startDate && endDate) {
    query.weekStart = { $gte: new Date(startDate).setUTCHours(0, 0, 0, 0) };
    query.weekEnd = { $lte: new Date(endDate).setUTCHours(23, 59, 59, 999) };
  }
  if (paidStatus !== undefined && paidStatus !== null && paidStatus !== '') {
    query.paid = paidStatus === 'true';
  }

  if (req.user.role === 'supervisor') {
    const assignedSites = req.user.assignedSites.map(id => id.toString());
    if (query.siteId && !assignedSites.includes(query.siteId.toString())) {
      res.status(403).json({ message: 'Not authorized to view salary logs for this site' });
      return;
    }
    if (!query.siteId) {
      query.siteId = { $in: assignedSites };
    }
  }

  const salaryLogs = await SalaryLog.find(query)
    .populate('workerId', 'name role')
    .populate('siteId', 'name')
    .populate('recordedBy', 'name');

  res.json(salaryLogs);
});

// @desc    Update Salary Log Paid Status
// @route   PUT /api/reports/salary-logs/:id/paid
// @access  Private (Admin only)
const updateSalaryLogPaidStatus = asyncHandler(async (req, res) => {
  const { paid, paymentDate } = req.body;
  const salaryLogId = req.params.id;

  const salaryLog = await SalaryLog.findById(salaryLogId);

  if (!salaryLog) {
    res.status(404).json({ message: 'Salary log not found' });
    return;
  }

  try {
    salaryLog.paid = paid;
    salaryLog.paymentDate = paid ? (paymentDate || new Date()) : null;

    // Determine recordedBy ID for the update: Use actual user ID if it's a valid ObjectId,
    // otherwise, use a placeholder ObjectId for dev users to pass validation.
    let recordedById;
    if (req.user._id === 'dev_admin_id' || req.user._id === 'dev_supervisor_id') {
        recordedById = new mongoose.Types.ObjectId('60a7b1b3c9f2b1001a4e2d3c'); // Use the same static dummy ObjectId
    } else {
        recordedById = req.user._id;
    }

    // Explicitly set recordedBy to ensure it's present and valid during save
    // Only update if it's currently null/undefined or if it's the dummy ID
    if (!salaryLog.recordedBy || salaryLog.recordedBy.toString() === '60a7b1b3c9f2b1001a4e2d3c') {
        salaryLog.recordedBy = recordedById;
    }


    const updatedSalaryLog = await salaryLog.save();
    res.json({ message: 'Salary log updated successfully', updatedSalaryLog });
  } catch (error) {
    console.error('Error saving updated salary log:', error);
    res.status(500).json({ message: 'Failed to update salary log paid status.', error: error.message });
  }
});


module.exports = {
  generateReport,
  calculateAndLogWeeklySalaries,
  getSalaryLogs,
  updateSalaryLogPaidStatus,
};