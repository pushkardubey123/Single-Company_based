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

// ... inside your existing Leave Schema ...
    leaveType: {
      type: String, 
      required: true,
      // REMOVE the enum line: enum: ["Casual", "Sick", "Earned"], 
      // We will now accept strings that match the company's active leave types
    },
    // Optional: You can also store the leaveTypeId for stricter linking
    leaveTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LeaveType"
    },
// ... rest of the schema
    startDate: Date,
    endDate: Date,
    reason: String,
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