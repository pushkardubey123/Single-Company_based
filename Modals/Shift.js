const mongoose = require("mongoose");

const shiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { timestamps: true }
);

const shiftTbl = mongoose.model("Shift", shiftSchema);
module.exports = shiftTbl;
