const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["Attendance", "Leaves", "Exit", "Employee", "Custom"],
    required: true,
  },
  filterParams: {
    type: Object,
    default: {},
  },
  fileUrl: {
    type: String,
    required: true,
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Report", reportSchema);
