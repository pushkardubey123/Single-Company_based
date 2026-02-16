const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // admin/company
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    date: { type: Date, required: true },
    inTime: { type: String, required: true },
    outTime: { type: String },

status: {
    type: String,
    // 🔥 New Status Added
    enum: ["Present", "Absent", "Late", "Half Day", "On Leave", "Holiday", "Weekly Off"], 
    default: "Present",
  },

    statusType: {
      type: String,
      enum: ["Auto", "Manual"],
      default: "Auto",
    },

    location: {
      latitude: Number,
      longitude: Number,
    },

    inOutLogs: [
      {
        inTime: String,
        outTime: String,
      },
    ],
    workedMinutes: {
  type: Number,
  default: 0,
},

overtimeMinutes: {
  type: Number,
  default: 0,
},

overtimeApproved: {
  type: Boolean,
  default: false,
},

adminCheckoutTime: {
  type: String, // "07:30 PM"
},

  },
  { timestamps: true }
);
const attendanceTbl = mongoose.model("Attendance", attendanceSchema);
module.exports = attendanceTbl;

