const mongoose = require("mongoose");

const OfficeTimingSchema = new mongoose.Schema(
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
    officeStart: {
      type: String, // "10:00"
      required: true,
    },
    officeEnd: {
      type: String, // "18:00"
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OfficeTiming", OfficeTimingSchema);
