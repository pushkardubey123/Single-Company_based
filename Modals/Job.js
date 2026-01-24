const mongoose= require("mongoose");

const JobSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // admin
    required: true,
    index: true,
  },

  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    index: true,
  },

  title: { type: String, required: true },

  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    required: true,
  },

  designationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Designation",
    required: true,
  },

  positions: Number,
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },

  startDate: Date,
  endDate: Date,

  skills: [String],
  description: String,
  requirement: String,

  askGender: Boolean,
  askDob: Boolean,
  askAddress: Boolean,

  showProfileImage: Boolean,
  showResume: Boolean,
  showCoverLetter: Boolean,
  showTerms: Boolean,

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("Job", JobSchema);
