const mongoose = require("mongoose");

const PendingUserSchema = new mongoose.Schema({
  companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
  name: String,
  email: { type: String, required: true, unique: true },
  phone: String,
  password: String,
  
  // ✅ NEW FIELDS ADDED: Iske bina Mongoose data strip kar dega
  authProvider: { type: String, default: "local" },
  googleId: { type: String },

  gender: String,
  dob: Date,
  address: String,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
  designationId: { type: mongoose.Schema.Types.ObjectId, ref: "Designation" },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift" },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
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