const mongoose = require("mongoose");

const BranchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true }, // ✅ New field
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  radius: { type: Number, default: 100 }, // meters
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Branch", BranchSchema);
