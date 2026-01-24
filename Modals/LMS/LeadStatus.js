const mongoose = require("mongoose");

const LeadStatusSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // New, Contacted, Follow-up, Approved, Converted
  color: { type: String }, // For dashboard visualization
});

module.exports = mongoose.model("LeadStatus", LeadStatusSchema);
