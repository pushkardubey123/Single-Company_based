const mongoose = require("mongoose");

const DesignationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
  },
  { timestamps: true }
);

designationTBl = mongoose.model("Designation", DesignationSchema);

module.exports = designationTBl;
