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

router.post("/", createLeave);

router.get("/", getAllLeaves);

router.get("/employee/:id", authMiddleware, getLeavesByEmployee);

router.get("/report", authMiddleware, getLeaveReport);

router.get("/:id", getLeaveById);

router.put("/:id", updateLeaveStatus);

router.delete("/:id", deleteLeave);

module.exports = router;
