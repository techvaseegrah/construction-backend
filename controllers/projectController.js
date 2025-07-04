// construction/backend/controllers/projectController.js
const asyncHandler = require('express-async-handler');
const Site = require('../models/Site');
const Worker = require('../models/Worker');
const User = require('../models/User'); // For assigning supervisors

// @desc    Get all projects/sites
// @route   GET /api/projects
// @access  Private (Admin/Supervisor - supervisors get only their assigned)
const getProjects = asyncHandler(async (req, res) => {
  let query = {};
  // If supervisor, filter by assigned sites
  if (req.user.role === 'supervisor') {
    query = {
      _id: {
        $in: req.user.assignedSites
      }
    };
  }

  const projects = await Site.find(query)
    .populate('supervisors', 'name username')
    .populate('assignedWorkers.workerId', 'name role rfidId'); // Populate worker details
  res.json(projects);
});

// @desc    Get single project/site by ID
// @route   GET /api/projects/:id
// @access  Private (Admin/Supervisor - supervisors only their assigned)
const getProjectById = asyncHandler(async (req, res) => {
  console.log('Attempting to get project by ID:', req.params.id); // Keep this log for verification

  const project = await Site.findById(req.params.id)
    .populate('supervisors', 'name username') // This populates the 'supervisors' array
    .populate('assignedWorkers.workerId', 'name role rfidId');

  if (!project) {
    res.status(404).json({
      message: 'Project not found'
    });
    return;
  }

  // If supervisor, ensure they are assigned to this site
  if (req.user.role === 'supervisor') {
    // CORRECTED LINE: Use project.supervisors instead of project.assignedSupervisor
    const isAssignedToSupervisor = project.supervisors.some(
      (supervisor) => supervisor._id.toString() === req.user._id.toString()
    );

    if (!isAssignedToSupervisor) {
      res.status(403).json({
        message: 'Not authorized to view this project'
      });
      return;
    }
  }
  res.json(project);
});

// @desc    Create a new project/site
// @route   POST /api/projects
// @access  Private (Admin only)
const createProject = asyncHandler(async (req, res) => {
  const {
    name,
    type,
    location,
    startDate,
    supervisors,
    assignedWorkers
  } = req.body;

  // Validate supervisors exist and are supervisors
  if (supervisors && supervisors.length > 0) {
    const existingSupervisors = await User.find({
      _id: {
        $in: supervisors
      },
      role: 'supervisor'
    });
    if (existingSupervisors.length !== supervisors.length) {
      res.status(400).json({
        message: 'One or more supervisor IDs are invalid or not supervisors'
      });
      return;
    }
  }

  // Validate assignedWorkers (workerId exists, name and role are provided)
  if (assignedWorkers && assignedWorkers.length > 0) {
    for (const assignedWorker of assignedWorkers) {
      const worker = await Worker.findById(assignedWorker.workerId);
      if (!worker) {
        res.status(400).json({
          message: `Worker with ID ${assignedWorker.workerId} not found`
        });
        return;
      }
      if (!assignedWorker.name) assignedWorker.name = worker.name;
      if (!assignedWorker.role) assignedWorker.role = worker.role;
    }
  }

  const project = await Site.create({
    name,
    type,
    location,
    startDate,
    supervisors: supervisors || [],
    assignedWorkers: assignedWorkers || [],
  });

  // Update assignedSites for supervisors
  if (supervisors && supervisors.length > 0) {
    await User.updateMany({
      _id: {
        $in: supervisors
      }
    }, {
      $addToSet: {
        assignedSites: project._id
      }
    });
  }

  // Update assignedProjects for workers
  if (assignedWorkers && assignedWorkers.length > 0) {
    for (const workerEntry of assignedWorkers) {
      await Worker.findByIdAndUpdate(workerEntry.workerId, {
        $addToSet: {
          assignedProjects: {
            siteId: project._id,
            siteName: project.name,
            projectSalary: workerEntry.salaryOverride
          }
        }
      });
    }
  }

  res.status(201).json(project);
});

// @desc    Update a project/site
// @route   PUT /api/projects/:id
// @access  Private (Admin only)
const updateProject = asyncHandler(async (req, res) => {
  const {
    name,
    type,
    location,
    startDate,
    supervisors,
    assignedWorkers
  } = req.body;

  const project = await Site.findById(req.params.id);

  if (project) {
    // Old supervisors to remove from sites and workers to remove from projects
    const oldSupervisors = [...project.supervisors];
    const oldAssignedWorkers = [...project.assignedWorkers];

    // Update project fields
    project.name = name || project.name;
    project.type = type || project.type;
    project.location = location || project.location;
    project.startDate = startDate || project.startDate;
    project.presentDate = req.body.presentDate || project.presentDate; // Allows admin to manually set present date

    // Handle supervisors array: First remove from old, then add to new
    if (supervisors !== undefined) {
      // Supervisors to remove
      const supervisorsToRemove = oldSupervisors.filter(supId => !supervisors.includes(supId.toString()));
      await User.updateMany({
        _id: {
          $in: supervisorsToRemove
        }
      }, {
        $pull: {
          assignedSites: project._id
        }
      });

      // Supervisors to add
      const supervisorsToAdd = supervisors.filter(supId => !oldSupervisors.map(id => id.toString()).includes(supId));
      await User.updateMany({
        _id: {
          $in: supervisorsToAdd
        }
      }, {
        $addToSet: {
          assignedSites: project._id
        }
      });

      project.supervisors = supervisors;
    }

    // Handle assignedWorkers array
    if (assignedWorkers !== undefined) {
      // Workers to remove from this project's assignedWorkers list
      const workersToRemove = oldAssignedWorkers.filter(aw => !assignedWorkers.some(newAw => newAw.workerId === aw.workerId.toString()));
      for (const workerEntry of workersToRemove) {
        await Worker.findByIdAndUpdate(workerEntry.workerId, {
          $pull: {
            assignedProjects: {
              siteId: project._id
            }
          }
        });
      }

      // Workers to add or update
      for (const newWorkerEntry of assignedWorkers) {
        const existingWorkerAssignment = oldAssignedWorkers.find(aw => aw.workerId.toString() === newWorkerEntry.workerId);

        if (existingWorkerAssignment) {
          // Update existing assignment (e.g., salary override)
          if (existingWorkerAssignment.salaryOverride !== newWorkerEntry.salaryOverride ||
            existingWorkerAssignment.name !== newWorkerEntry.name ||
            existingWorkerAssignment.role !== newWorkerEntry.role) {

            // Update in Site model's assignedWorkers array
            await Site.updateOne({
              _id: project._id,
              'assignedWorkers.workerId': newWorkerEntry.workerId
            }, {
              '$set': {
                'assignedWorkers.$.salaryOverride': newWorkerEntry.salaryOverride,
                'assignedWorkers.$.name': newWorkerEntry.name,
                'assignedWorkers.$.role': newWorkerEntry.role,
              }
            });

            // Update in Worker model's assignedProjects array
            await Worker.updateOne({
              _id: newWorkerEntry.workerId,
              'assignedProjects.siteId': project._id
            }, {
              '$set': {
                'assignedProjects.$.projectSalary': newWorkerEntry.salaryOverride,
                'assignedProjects.$.siteName': project.name
              }
            }
          );
          }
        } else {
          // Add new worker assignment to project
          project.assignedWorkers.push({
            workerId: newWorkerEntry.workerId,
            name: newWorkerEntry.name,
            role: newWorkerEntry.role,
            salaryOverride: newWorkerEntry.salaryOverride
          });

          // Add project to worker's assignedProjects
          await Worker.findByIdAndUpdate(newWorkerEntry.workerId, {
            $addToSet: {
              assignedProjects: {
                siteId: project._id,
                siteName: project.name,
                projectSalary: newWorkerEntry.salaryOverride
              }
            }
          });
        }
      }
      // This is crucial: Set the project.assignedWorkers to the new list after all updates are done
      project.assignedWorkers = assignedWorkers;
    }


    const updatedProject = await project.save();
    res.json(updatedProject);

  } else {
    res.status(404).json({
      message: 'Project not found'
    });
  }
});

// @desc    Delete a project/site
// @route   DELETE /api/projects/:id
// @access  Private (Admin only)
const deleteProject = asyncHandler(async (req, res) => {
  console.log(`Attempting to delete project with ID: ${req.params.id}`);

  const project = await Site.findById(req.params.id);

  if (project) {
    console.log(`Found project: ${project.name}. Initiating cascading deletes.`);

    try {
      // Remove project from supervisors' assignedSites
      await User.updateMany({
        assignedSites: project._id
      }, {
        $pull: {
          assignedSites: project._id
        }
      });
      console.log('Removed project from supervisors.');
    } catch (error) {
      console.error('Error removing project from supervisors:', error);
      // Don't return, try to proceed with other deletions if possible, or decide strictness
    }

    try {
      // Remove project from workers' assignedProjects
      await Worker.updateMany({
        'assignedProjects.siteId': project._id
      }, {
        $pull: {
          assignedProjects: {
            siteId: project._id
          }
        }
      });
      console.log('Removed project from workers.');
    } catch (error) {
      console.error('Error removing project from workers:', error);
    }

    try {
      // Also delete associated attendance, material, activity, salary logs
      await AttendanceEntry.deleteMany({
        siteId: project._id
      });
      console.log('Deleted associated attendance entries.');
    } catch (error) {
      console.error('Error deleting attendance entries:', error);
    }

    try {
      await MaterialEntry.deleteMany({
        siteId: project._id
      });
      console.log('Deleted associated material entries.');
    } catch (error) {
      console.error('Error deleting material entries:', error);
    }

    try {
      await ActivityLog.deleteMany({
        siteId: project._id
      });
      console.log('Deleted associated activity logs.');
    } catch (error) {
      console.error('Error deleting activity logs:', error);
    }

    try {
      await AdvanceEntry.deleteMany({
        siteId: project._id
      });
      console.log('Deleted associated advance entries.');
    } catch (error) {
      console.error('Error deleting advance entries:', error);
    }

    try {
      await SalaryLog.deleteMany({
        siteId: project._id
      });
      console.log('Deleted associated salary logs.');
    } catch (error) {
      console.error('Error deleting salary logs:', error);
    }

    try {
      await project.deleteOne(); // Finally delete the project itself
      console.log(`Project ${project.name} (ID: ${project._id}) removed successfully.`);
      res.json({
        message: 'Project removed'
      });
    } catch (error) {
      console.error('Error deleting the project document itself:', error);
      res.status(500).json({ message: 'Failed to delete project document.', error: error.message });
    }

  } else {
    console.log(`Project with ID ${req.params.id} not found for deletion.`);
    res.status(404).json({
      message: 'Project not found'
    });
  }
});

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};