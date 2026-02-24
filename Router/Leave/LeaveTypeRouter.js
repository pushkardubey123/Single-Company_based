const express = require("express");
const router = express.Router();
const auth = require("../../Middleware/auth");
const attachCompanyContext = require("../../Middleware/companyMiddleware");
const { getLeaveTypes, createLeaveType, deleteLeaveType,updateLeaveType } = require("../../Controllers/Leave/LeaveTypeController");

router.get("/", auth, attachCompanyContext, getLeaveTypes);
router.post("/", auth, attachCompanyContext, createLeaveType);
router.delete("/:id", auth, attachCompanyContext, deleteLeaveType);
router.put("/:id", auth, attachCompanyContext, updateLeaveType);

module.exports = router;