const mongoose = require('mongoose');

const salaryLogSchema = mongoose.Schema({
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true,
  },
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true,
  },
  weekStart: {
    type: Date,
    required: true,
  },
  weekEnd: {
    type: Date,
    required: true,
  },
  totalAttendanceDays: { // Sum of multipliers
    type: Number,
    required: true,
  },
  shiftDetails: [{ // Array to store details like { date: Date, shiftType: String, multiplier: Number }
    date: Date,
    shiftType: String,
    multiplier: Number
  }],
  dailyRateUsed: { // The daily rate used for this calculation (baseSalary or projectSalary)
    type: Number,
    required: true,
  },
  grossSalary: { // totalAttendanceDays * dailyRateUsed
    type: Number,
    required: true,
  },
  totalAdvanceDeducted: {
    type: Number,
    default: 0,
  },
  netSalary: { // grossSalary - totalAdvanceDeducted
    type: Number,
    required: true,
  },
  paid: {
    type: Boolean,
    default: false,
  },
  paymentDate: {
    type: Date,
  }
}, {
  timestamps: true,
});

const SalaryLog = mongoose.model('SalaryLog', salaryLogSchema);

module.exports = SalaryLog;
