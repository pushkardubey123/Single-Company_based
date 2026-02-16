const mongoose = require("mongoose");

const LeaveTypeSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  description: String,
  
  // 🔥 NEW FIELD ADDED: Saal bhar mein kitni leave allowed hain (e.g. 12)
  daysAllowed: { type: Number, required: true, default: 12 }, 

  isPaid: { type: Boolean, default: false },
  allowCarryForward: { type: Boolean, default: false },
  maxCarryForwardDays: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("LeaveType", LeaveTypeSchema);