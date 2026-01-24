const mongoose = require("mongoose");

const LeadSourceSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // LinkedIn, Facebook, Website, Referral
  description: { type: String },
});

module.exports = mongoose.model("LeadSource", LeadSourceSchema);
