const mongoose = require("mongoose");

const BranchSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // ADMIN = COMPANY
    required: true,
    index: true,
  },
  name: { type: String, required: true },
  address: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  radius: { type: Number, default: 100 },
  createdAt: { type: Date, default: Date.now },
});

// same company me same name ki duplicate branch nahi
BranchSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Branch", BranchSchema);
