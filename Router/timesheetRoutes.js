const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const {
  getTimesheetReport,
  getEmployeeTimesheet,
} = require("../Controllers/timesheetController");

router.get("/all", auth, getTimesheetReport);
router.get("/employee/:id", getEmployeeTimesheet);
module.exports = router;
