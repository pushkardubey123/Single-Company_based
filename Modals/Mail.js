const mongoose = require("mongoose");

const mailSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recipients: [{ type: String }],
  subject: String,
  message: String,
  attachments: [String],
  trashedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  permanentlyDeletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Mails", mailSchema);
