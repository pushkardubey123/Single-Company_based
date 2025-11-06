const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    name: String,
    email: String,
    phone: String,
    resume: String,
    coverLetter: String,
    profileImage: String,
    status: {
      type: String,
      enum: ["applied", "shortlisted", "rejected", "interview_scheduled"],
      default: "applied",
    },
    interviewMeeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", applicationSchema);
