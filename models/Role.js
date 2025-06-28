const mongoose = require('mongoose');

const roleSchema = mongoose.Schema({
  roleName: {
    type: String,
    required: true,
    unique: true,
  },
  defaultSalary: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true,
});

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;