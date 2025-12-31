const express = require("express");
const router = express.Router();
const {
  createLeave,
  getAllLeaves,
  getLeaveById,
  updateLeaveStatus,
  deleteLeave,
  getLeavesByEmployee,
  getLeaveReport,
} = require("../Controllers/LeaveController");
const authMiddleware = require("../Middleware/auth");
const attachCompanyContext = require("../Middleware/companyMiddleware");

router.post(
  "/",
  authMiddleware,
  attachCompanyContext,
  createLeave
);

router.get(
  "/",
  authMiddleware,
  attachCompanyContext,
  getAllLeaves
);

router.get(
  "/employee/:id",
  authMiddleware,
  attachCompanyContext,
  getLeavesByEmployee
);

router.get(
  "/report",
  authMiddleware,
  attachCompanyContext,
  getLeaveReport
);

router.get(
  "/:id",
  authMiddleware,
  attachCompanyContext,
  getLeaveById
);

router.put(
  "/:id",
  authMiddleware,
  attachCompanyContext,
  updateLeaveStatus
);

router.delete(
  "/:id",
  authMiddleware,
  attachCompanyContext,
  deleteLeave
);


module.exports = router;
