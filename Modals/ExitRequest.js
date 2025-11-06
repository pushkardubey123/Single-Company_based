const mongoose = require("mongoose");

const ExitRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    resignationDate: {
      type: Date,
      required: true,
    },
    interviewFeedback: {
      type: String,
      default: "",
    },
    clearanceStatus: {
      type: String,
      enum: ["pending", "cleared", "on-hold"],
      default: "pending",
    },
    finalSettlement: {
      amount: {
        type: Number,
        default: 0,
      },
      settledOn: {
        type: Date,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("exit_requests", ExitRequestSchema);
