const mongoose = require("mongoose");

const leaveSettingsSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  
  // 🔥 Global Weekly Off Settings
  isSaturdayOff: { type: Boolean, default: true }, // Admin toggle karega
  isSundayOff: { type: Boolean, default: true },   // Always true usually
  
}, { timestamps: true });

module.exports = mongoose.model("LeaveSettings", leaveSettingsSchema);