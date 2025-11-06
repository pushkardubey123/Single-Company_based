const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    inTime: {
      type: String,
      required: true,
    },
    outTime: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "Half Day", "On Leave"],
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
  },
  { timestamps: true }
);

const attendanceTbl = mongoose.model("Attendance", attendanceSchema);
module.exports = attendanceTbl;
