const mongoose = require("mongoose");

const mailSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    default: null,
  },

  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recipients: [{ type: String }],
  subject: String,
  message: String,
  attachments: [String],

  // --- NEW FIELDS ADDED ---
  isDraft: { type: Boolean, default: false }, // Agar true hai toh Draft hai
  starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Jo log star karenge unka ID
  spamBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Jo spam mark karenge unka ID
  // ------------------------

  trashedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  permanentlyDeletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Mails", mailSchema);