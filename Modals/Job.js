const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
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

    positions: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    skills: [{ type: String }],

    description: { type: String, required: true },
    requirement: { type: String, required: true },

    askGender: { type: Boolean, default: false },
    askDob: { type: Boolean, default: false },
    askAddress: { type: Boolean, default: false },

    showProfileImage: { type: Boolean, default: false },
    showResume: { type: Boolean, default: false },
    showCoverLetter: { type: Boolean, default: false },
    showTerms: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", JobSchema);
