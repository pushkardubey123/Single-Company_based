const mongoose = require("mongoose");

const authorizedPersonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },
  role: { type: String, default: "" },
});

const attendanceSchema = new mongoose.Schema({
  gpsRequired: { type: Boolean, default: true }, 
  faceRequired: { type: Boolean, default: false }, // Yeh trigger hai
  lateMarkTime: { type: String, default: "09:30" }, 
  earlyLeaveTime: { type: String, default: "17:30" }, 
});

const companySchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  name: { type: String, required: true },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },
  address: { type: String, default: "" },
  website: { type: String, default: "" },
  logo: { type: String, default: "" },
  companyType: { type: String, default: "" },
  registrationNumber: { type: String, default: "" },
  gstNumber: { type: String, default: "" },
  panNumber: { type: String, default: "" },
  cinNumber: { type: String, default: "" },
  attendance: { type: attendanceSchema, default: () => ({}) },
  authorizedPersons: { type: [authorizedPersonSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

companySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("CompanySettings", companySchema);