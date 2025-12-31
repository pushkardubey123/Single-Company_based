const mongoose = require("mongoose");

const LeadActivitySchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
  activityType: { type: String, enum: ["Call", "Meeting", "Email", "Note"], required: true },
  description: { type: String },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  activityDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model("LeadActivity", LeadActivitySchema);
