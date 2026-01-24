const express = require("express");
const router = express.Router();

const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");

const {
  getTimesheetReport,
  getEmployeeTimesheet,
} = require("../Controllers/timesheetController");

// ADMIN (Company + Branch scoped)
router.get("/all", auth, attachCompanyId, getTimesheetReport);

// EMPLOYEE / ADMIN (single employee)
router.get("/employee/:id", auth, attachCompanyId, getEmployeeTimesheet);

module.exports = router;
