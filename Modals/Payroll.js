const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // admin user acts as company
    required: true,
  },

  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
  },

  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  month: {
    type: String,
    required: true, // YYYY-MM
  },

  basicSalary: {
    type: Number,
    required: true,
  },

  workingDays: {
    type: Number,
    default: 0,
  },

  paidDays: {
    type: Number,
    default: 0,
  },

  allowances: [
    {
      title: String,
      amount: Number,
    },
  ],

  deductions: [
    {
      title: String,
      amount: Number,
    },
  ],

  netSalary: {
    type: Number,
    required: true,
  },

  status: {
    type: String,
    enum: ["Pending", "Paid"],
    default: "Pending",
  },

  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Payroll", payrollSchema);
