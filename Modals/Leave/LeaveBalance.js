const mongoose = require("mongoose");

const leaveBalanceSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    leaveTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },

    year: { type: Number, required: true },

    totalCredited: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    carryForwarded: { type: Number, default: 0 },

    lastAccruedMonth: { type: String }, // "2026-02"
  },
  { timestamps: true }
);

// one record per employee + leaveType + year
leaveBalanceSchema.index(
  { employeeId: 1, leaveTypeId: 1, year: 1 },
  { unique: true }
);

module.exports = mongoose.model("LeaveBalance", leaveBalanceSchema);
