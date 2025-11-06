const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const {
  addShift,
  getShifts,
  updateShift,
  deleteShift,
} = require("../Controllers/ShiftController");

router.post("/", auth, addShift);
router.get("/", getShifts);
router.put("/:id", auth, updateShift);
router.delete("/:id", auth, deleteShift);

module.exports = router;
