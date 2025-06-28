const asyncHandler = require('express-async-handler');
const Worker = require('../models/Worker');
const Site = require('../models/Site');
const Role = require('../models/Role'); // To get default salary for role

// @desc    Get all workers
// @route   GET /api/workers
// @access  Private (Admin/Supervisor)
const getWorkers = asyncHandler(async (req, res) => {
  let query = {};
  // Supervisors can only see workers assigned to their sites
  if (req.user.role === 'supervisor') {
    const assignedSites = req.user.assignedSites;
    if (assignedSites && assignedSites.length > 0) {
      // Find workers who have any assignedProjects matching the supervisor's assigned sites
      query['assignedProjects.siteId'] = {
        $in: assignedSites
      };
    } else {
      // If supervisor has no assigned sites, return no workers
      return res.json([]);
    }
  }

  const workers = await Worker.find(query);
  res.json(workers);
});

// @desc    Get single worker by ID
// @route   GET /api/workers/:id
// @access  Private (Admin/Supervisor)
const getWorkerById = asyncHandler(async (req, res) => {
  const worker = await Worker.findById(req.params.id);

  if (worker) {
    // If supervisor, ensure worker is assigned to one of their sites
    if (req.user.role === 'supervisor') {
      const isAssignedToSupervisorSite = worker.assignedProjects.some(
        project => req.user.assignedSites.includes(project.siteId.toString())
      );
      if (!isAssignedToSupervisorSite) {
        res.status(403).json({
          message: 'Not authorized to view this worker'
        });
        return;
      }
    }
    res.json(worker);
  } else {
    res.status(404).json({
      message: 'Worker not found'
    });
  }
});

// @desc    Create a new worker
// @route   POST /api/workers
// @access  Private (Admin only)
const createWorker = asyncHandler(async (req, res) => {
  const {
    name,
    role,
    baseSalary,
    rfidId,
    assignedProjects
  } = req.body;

  // Get default salary from Role if baseSalary not provided
  let determinedBaseSalary = baseSalary;
  if (!determinedBaseSalary && role) {
    const roleData = await Role.findOne({
      roleName: role
    });
    if (roleData) {
      determinedBaseSalary = roleData.defaultSalary;
    }
  }

  if (!determinedBaseSalary) {
    res.status(400).json({
      message: 'Base salary or a valid role with default salary is required'
    });
    return;
  }

  const worker = await Worker.create({
    name,
    role,
    baseSalary: determinedBaseSalary,
    rfidId,
    assignedProjects: [], // Initially empty, will be populated by project assignments
  });

  // Assign worker to projects and update sites if assignedProjects provided
  if (assignedProjects && assignedProjects.length > 0) {
    for (const projectAssignment of assignedProjects) {
      const site = await Site.findById(projectAssignment.siteId);
      if (site) {
        // Add to worker's assignedProjects
        worker.assignedProjects.push({
          siteId: site._id,
          siteName: site.name,
          projectSalary: projectAssignment.projectSalary || null,
        });

        // Add to site's assignedWorkers if not already there
        const isWorkerAssignedToSite = site.assignedWorkers.some(aw => aw.workerId.toString() === worker._id.toString());
        if (!isWorkerAssignedToSite) {
          site.assignedWorkers.push({
            workerId: worker._id,
            name: worker.name,
            role: worker.role,
            salaryOverride: projectAssignment.projectSalary || null,
          });
          await site.save(); // Save site updates
        }
      }
    }
    await worker.save(); // Save worker updates
  }

  res.status(201).json(worker);
});

// @desc    Update a worker
// @route   PUT /api/workers/:id
// @access  Private (Admin only)
const updateWorker = asyncHandler(async (req, res) => {
  const {
    name,
    role,
    baseSalary,
    rfidId,
    assignedProjects
  } = req.body;

  const worker = await Worker.findById(req.params.id);

  if (worker) {
    worker.name = name || worker.name;
    worker.role = role || worker.role;
    worker.baseSalary = baseSalary || worker.baseSalary;
    worker.rfidId = rfidId || worker.rfidId;

    // Handle assignedProjects update
    const oldAssignedProjects = [...worker.assignedProjects];

    if (assignedProjects !== undefined) {
      // Projects to remove from worker's assignedProjects
      const projectsToRemove = oldAssignedProjects.filter(ap => !assignedProjects.some(newAp => newAp.siteId === ap.siteId.toString()));
      for (const projectAssignment of projectsToRemove) {
        await Site.updateOne({
          _id: projectAssignment.siteId
        }, {
          $pull: {
            assignedWorkers: {
              workerId: worker._id
            }
          }
        });
      }

      // Projects to add or update in worker's assignedProjects
      worker.assignedProjects = []; // Clear existing to rebuild
      for (const newProjectAssignment of assignedProjects) {
        const site = await Site.findById(newProjectAssignment.siteId);
        if (site) {
          // Add to worker's assignedProjects
          worker.assignedProjects.push({
            siteId: site._id,
            siteName: site.name,
            projectSalary: newProjectAssignment.projectSalary || null,
          });

          // Add/Update to site's assignedWorkers
          const existingSiteWorker = site.assignedWorkers.find(aw => aw.workerId.toString() === worker._id.toString());
          if (existingSiteWorker) {
            existingSiteWorker.name = worker.name;
            existingSiteWorker.role = worker.role;
            existingSiteWorker.salaryOverride = newProjectAssignment.projectSalary || null;
          } else {
            site.assignedWorkers.push({
              workerId: worker._id,
              name: worker.name,
              role: worker.role,
              salaryOverride: newProjectAssignment.projectSalary || null,
            });
          }
          await site.save();
        }
      }
    }


    const updatedWorker = await worker.save();
    res.json(updatedWorker);
  } else {
    res.status(404).json({
      message: 'Worker not found'
    });
  }
});

// @desc    Delete a worker
// @route   DELETE /api/workers/:id
// @access  Private (Admin only)
const deleteWorker = asyncHandler(async (req, res) => {
  const worker = await Worker.findById(req.params.id);

  if (worker) {
    // Remove worker from all assigned projects/sites
    await Site.updateMany({
      'assignedWorkers.workerId': worker._id
    }, {
      $pull: {
        assignedWorkers: {
          workerId: worker._id
        }
      }
    });

    // Delete all associated attendance, advance, and salary logs
    await AttendanceEntry.deleteMany({
      workerId: worker._id
    });
    await AdvanceEntry.deleteMany({
      workerId: worker._id
    });
    await SalaryLog.deleteMany({
      workerId: worker._id
    });

    await worker.deleteOne();
    res.json({
      message: 'Worker removed'
    });
  } else {
    res.status(404).json({
      message: 'Worker not found'
    });
  }
});

module.exports = {
  getWorkers,
  getWorkerById,
  createWorker,
  updateWorker,
  deleteWorker,
};