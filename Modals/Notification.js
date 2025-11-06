const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  type: {
    type: String,
    default: "custom",
  },
  image: { type: String },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  isGlobal: {
    type: Boolean,
    default: false,
  },
  removedFromBell: {
    type: Boolean,
    default: false,
  },
  meta: {
    type: Object,
    default: {},
  },
});

module.exports = mongoose.model("Notification", notificationSchema);
