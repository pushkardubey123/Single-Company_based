const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
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

    title: { type: String, required: true },
    description: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    color: String,

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    departmentId: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],
    employeeId: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", EventSchema);
