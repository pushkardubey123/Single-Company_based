const mongoose = require("mongoose");

const DesignationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

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

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
  },
  { timestamps: true }
);

DesignationSchema.index(
  { name: 1, companyId: 1, branchId: 1, departmentId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Designation", DesignationSchema);
