const mongoose = require("mongoose")

const leaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    leaveType: {
      type: String, 
      required: true,
    },
    leaveTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LeaveType"
    },
    startDate: Date,
    endDate: Date,
    reason: String,
    
    // ✅ BAS YE EK LINE ADD KARNI HAI YAHAN
    days: { 
        type: Number 
    },
    
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    appliedDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Leave", leaveSchema);