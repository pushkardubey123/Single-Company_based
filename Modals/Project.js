const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  commentText: { type: String, required: true },
  commentedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  commentedAt: { type: Date, default: Date.now },
});

const TimeLogSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  hours: { type: Number, required: true },
  logDate: { type: Date, default: Date.now },
});

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  assignedTo: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "User",
    default: [],
  },
  status: {
    type: String,
    enum: ["pending", "in-progress", "completed"],
    default: "pending",
  },
  dueDate: Date,
  comments: [CommentSchema],
  timeLogs: [TimeLogSchema],
});

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  startDate: Date,
  endDate: Date,
  status: {
    type: String,
    enum: ["not-started", "in-progress", "completed"],
    default: "not-started",
  },
  assignedEmployees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  tasks: [TaskSchema],
});

module.exports = mongoose.model("Project", ProjectSchema);
