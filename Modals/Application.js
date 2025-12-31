const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
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

  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    required: true,
  },

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
}, { timestamps: true });

module.exports = mongoose.model("Application", applicationSchema);
