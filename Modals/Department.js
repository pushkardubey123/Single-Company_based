const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema(
  {
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

    name: { type: String, required: true },
    description: { type: String },
  },
  { timestamps: true }
);

// same company + same branch me duplicate department na ho
DepartmentSchema.index(
  { companyId: 1, branchId: 1, name: 1 },
  { unique: true }
);

module.exports = mongoose.model("Department", DepartmentSchema);
