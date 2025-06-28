const asyncHandler = require('express-async-handler');
const AttendanceEntry = require('../models/AttendanceEntry');
const Worker = require('../models/Worker');
const Site = require('../models/Site');

// Helper to get multiplier based on shiftType
const getMultiplier = (shiftType) => {
  switch (shiftType) {
    case 'Full Day':
      return 1.0;
    case 'One-and-a-Half Day':
      return 1.5;
    case 'Half Day Morning':
      return 0.5;
    case 'Half Day Evening':
      return 0.5;
    default:
      return 0;
  }
};

// @desc    Mark attendance for a worker
// @route   POST /api/attendance/mark
// @access  Private (Supervisor/Admin)
const markAttendance = asyncHandler(async (req, res) => {
  const {
    workerId,
    siteId,
    date,
    shiftType
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
      message: 'Not authorized to mark attendance for this site'
    });
    return;
  }

  // Ensure worker is assigned to this site
  const isWorkerAssignedToSite = site.assignedWorkers.some(aw => aw.workerId.toString() === workerId);
  if (!isWorkerAssignedToSite) {
    res.status(400).json({
      message: 'Worker is not assigned to this site.'
    });
    return;
  }

  // Check for duplicate entry for the same worker, site, and date
  const existingEntry = await AttendanceEntry.findOne({
    workerId,
    siteId,
    date: new Date(date).setUTCHours(0, 0, 0, 0)
  });
  if (existingEntry) {
    res.status(400).json({
      message: 'Attendance already marked for this worker on this date at this site.'
    });
    return;
  }

  const multiplier = getMultiplier(shiftType);

  const attendance = await AttendanceEntry.create({
    workerId,
    siteId,
    date: new Date(date).setUTCHours(0, 0, 0, 0), // Store date without time
    shiftType,
    multiplier,
    timestamp: Date.now(),
  });

  res.status(201).json(attendance);
});

// @desc    Get attendance entries (filtered by site, date range, worker)
// @route   GET /api/attendance
// @access  Private (Admin/Supervisor)
const getAttendanceEntries = asyncHandler(async (req, res) => {
  const {
    siteId,
    workerId,
    startDate,
    endDate
  } = req.query;
  let query = {};

  if (siteId) {
    query.siteId = siteId;
  }
  if (workerId) {
    query.workerId = workerId;
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
        message: 'Not authorized to view attendance for this site'
      });
      return;
    }
    query.siteId = {
      $in: assignedSites
    };
  }

  const attendanceEntries = await AttendanceEntry.find(query)
    .populate('workerId', 'name role')
    .populate('siteId', 'name');

  res.json(attendanceEntries);
});


// @desc    Get attendance summary for all sites or a specific site for Admin
// @route   GET /api/attendance/overview
// @access  Private (Admin)
const getAttendanceOverview = asyncHandler(async (req, res) => {
  const {
    siteId,
    startDate,
    endDate
  } = req.query;

  let matchQuery = {};
  if (siteId) {
    matchQuery.siteId = new mongoose.Types.ObjectId(siteId);
  }
  if (startDate && endDate) {
    matchQuery.date = {
      $gte: new Date(startDate).setUTCHours(0, 0, 0, 0),
      $lte: new Date(endDate).setUTCHours(23, 59, 59, 999)
    };
  }

  // Aggregate attendance data
  const attendanceOverview = await AttendanceEntry.aggregate([
    // Filter by criteria
    {
      $match: matchQuery
    },
    // Group by site and worker to sum multipliers
    {
      $group: {
        _id: {
          siteId: '$siteId',
          workerId: '$workerId'
        },
        totalMultiplier: {
          $sum: '$multiplier'
        },
        datesPresent: {
          $push: {
            date: '$date',
            shiftType: '$shiftType',
            multiplier: '$multiplier'
          }
        }
      }
    },
    // Populate worker and site details (requires $lookup)
    {
      $lookup: {
        from: 'workers',
        localField: '_id.workerId',
        foreignField: '_id',
        as: 'workerDetails',
      }
    },
    {
      $unwind: '$workerDetails'
    }, // Deconstructs the array
    {
      $lookup: {
        from: 'sites',
        localField: '_id.siteId',
        foreignField: '_id',
        as: 'siteDetails',
      }
    },
    {
      $unwind: '$siteDetails'
    }, // Deconstructs the array
    // Project desired fields
    {
      $project: {
        _id: 0,
        workerId: '$_id.workerId',
        workerName: '$workerDetails.name',
        workerRole: '$workerDetails.role',
        siteId: '$_id.siteId',
        siteName: '$siteDetails.name',
        totalAttendanceDays: '$totalMultiplier', // This is the sum of multipliers
        datesPresent: '$datesPresent'
      }
    },
    // Group by site to get overall site summary if needed (optional)
    {
      $group: {
        _id: '$siteId',
        siteName: {
          $first: '$siteName'
        },
        workersAttendance: {
          $push: {
            workerId: '$workerId',
            workerName: '$workerName',
            workerRole: '$workerRole',
            totalAttendanceDays: '$totalAttendanceDays',
            datesPresent: '$datesPresent'
          }
        },
        totalWorkersPresent: {
          $sum: 1
        }
      }
    }
  ]);

  res.json(attendanceOverview);
});


// @desc    Update an attendance entry (e.g., correct shift type)
// @route   PUT /api/attendance/:id
// @access  Private (Admin/Supervisor)
const updateAttendance = asyncHandler(async (req, res) => {
  const {
    shiftType
  } = req.body;

  const attendance = await AttendanceEntry.findById(req.params.id);

  if (attendance) {
    // Ensure supervisor is authorized for this site
    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(attendance.siteId.toString())) {
      res.status(403).json({
        message: 'Not authorized to update attendance for this site'
      });
      return;
    }

    attendance.shiftType = shiftType || attendance.shiftType;
    attendance.multiplier = getMultiplier(attendance.shiftType); // Recalculate multiplier

    const updatedAttendance = await attendance.save();
    res.json(updatedAttendance);
  } else {
    res.status(404).json({
      message: 'Attendance entry not found'
    });
  }
});

// @desc    Delete an attendance entry
// @route   DELETE /api/attendance/:id
// @access  Private (Admin/Supervisor)
const deleteAttendance = asyncHandler(async (req, res) => {
  const attendance = await AttendanceEntry.findById(req.params.id);

  if (attendance) {
    // Ensure supervisor is authorized for this site
    if (req.user.role === 'supervisor' && !req.user.assignedSites.includes(attendance.siteId.toString())) {
      res.status(403).json({
        message: 'Not authorized to delete attendance for this site'
      });
      return;
    }

    await attendance.deleteOne();
    res.json({
      message: 'Attendance entry removed'
    });
  } else {
    res.status(404).json({
      message: 'Attendance entry not found'
    });
  }
});


module.exports = {
  markAttendance,
  getAttendanceEntries,
  getAttendanceOverview,
  updateAttendance,
  deleteAttendance,
};
