const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
  },

  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Application",
    required: true,
  },

  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    required: true,
  },

  candidateEmail: String,
  candidateName: String,

  title: String,
  description: String,
  date: Date,
  startTime: String,
  endTime: String,

  mode: { type: String, enum: ["Online", "Offline"] },
  location: String,

  googleMeetLink: String,
  calendarEventId: String,

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("Interview", interviewSchema);

