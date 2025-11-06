const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
  },
  { timestamps: true }
);

const departmentTbl = mongoose.model("Department", DepartmentSchema);

module.exports = departmentTbl;
