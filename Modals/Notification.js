const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // admin = company
    required: true,
    index: true,
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: false,
    index: true,
  },

  title: { type: String, required: true },
  message: { type: String, required: true },

  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false, // global/company notification ke liye null
  },

  type: { type: String, default: "custom" },
  image: { type: String },

  read: { type: Boolean, default: false },
  isGlobal: { type: Boolean, default: false },

  removedFromBell: { type: Boolean, default: false },

  meta: { type: Object, default: {} },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Notification", notificationSchema);
