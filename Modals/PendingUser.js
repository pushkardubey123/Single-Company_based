const mongoose = require("mongoose");

const PendingUserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  phone: String,
  password: String,
  gender: String,
  dob: Date,
  address: String,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
  designationId: { type: mongoose.Schema.Types.ObjectId, ref: "Designation" },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift" },
  doj: Date,
  pan: String,
  bankAccount: String,
  emergencyContact: {
    name: String,
    phone: String,
    relation: String,
  },
  profilePic: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("PendingUser", PendingUserSchema);
