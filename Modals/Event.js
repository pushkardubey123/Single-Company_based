const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    color: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    departmentId: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],
    employeeId: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const Event = mongoose.model("Event", EventSchema);
module.exports = Event;
