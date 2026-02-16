const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  
  // 🔥 RANGE SUPPORT: Single day ke liye start=end same rahega
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  
  isOptional: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Holiday", holidaySchema);