const asyncHandler = require('express-async-handler');
const Role = require('../models/Role');

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private (Admin/Supervisor)
const getRoles = asyncHandler(async (req, res) => {
  const roles = await Role.find({});
  res.json(roles);
});

// @desc    Get single role by ID
// @route   GET /api/roles/:id
// @access  Private (Admin only)
const getRoleById = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);

  if (role) {
    res.json(role);
  } else {
    res.status(404).json({
      message: 'Role not found'
    });
  }
});

// @desc    Create a new role
// @route   POST /api/roles
// @access  Private (Admin only)
const createRole = asyncHandler(async (req, res) => {
  const {
    roleName,
    defaultSalary
  } = req.body;

  const roleExists = await Role.findOne({
    roleName
  });
  if (roleExists) {
    res.status(400).json({
      message: 'Role with this name already exists'
    });
    return;
  }

  const role = await Role.create({
    roleName,
    defaultSalary,
  });

  if (role) {
    res.status(201).json(role);
  } else {
    res.status(400).json({
      message: 'Invalid role data'
    });
  }
});

// @desc    Update a role
// @route   PUT /api/roles/:id
// @access  Private (Admin only)
const updateRole = asyncHandler(async (req, res) => {
  const {
    roleName,
    defaultSalary
  } = req.body;

  const role = await Role.findById(req.params.id);

  if (role) {
    if (roleName && roleName !== role.roleName) {
      const roleNameExists = await Role.findOne({
        roleName
      });
      if (roleNameExists) {
        res.status(400).json({
          message: 'Role name already exists'
        });
        return;
      }
    }
    role.roleName = roleName || role.roleName;
    role.defaultSalary = defaultSalary || role.defaultSalary;

    const updatedRole = await role.save();
    res.json(updatedRole);
  } else {
    res.status(404).json({
      message: 'Role not found'
    });
  }
});

// @desc    Delete a role
// @route   DELETE /api/roles/:id
// @access  Private (Admin only)
const deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);

  if (role) {
    await role.deleteOne();
    res.json({
      message: 'Role removed'
    });
  } else {
    res.status(404).json({
      message: 'Role not found'
    });
  }
});

module.exports = {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
};