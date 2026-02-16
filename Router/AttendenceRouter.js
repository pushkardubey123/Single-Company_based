const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");

const {
  markAttendance,
  markSession,
  getAllAttendance,
  getAttendanceByEmployee,
  updateAttendance,
  deleteAttendance,
  bulkMarkAttendance,
  getMonthlyAttendance,
  adminApproveAction,
  syncPastAttendance,
  removeDuplicates
} = require("../Controllers/AttendenceController");

// 🔐 AUTH REQUIRED
router.post("/mark", auth,attachCompanyId, markAttendance);
router.post("/session", auth,attachCompanyId, markSession);

// ✅ ADD attachCompanyId HERE
router.get("/", auth, attachCompanyId, getAllAttendance);
router.get("/employee/:id", auth, attachCompanyId, getAttendanceByEmployee);
router.put("/approve-action", auth, attachCompanyId, adminApproveAction);
router.put("/:id", auth, attachCompanyId, updateAttendance)
router.post("/bulk", auth, attachCompanyId, bulkMarkAttendance);
router.get("/monthly", auth, attachCompanyId, getMonthlyAttendance);
router.post("/sync", auth, attachCompanyId, syncPastAttendance);
// ✅ CORRECT: Specific routes first, dynamic routes last
router.delete("/remove-duplicates", auth, attachCompanyId, removeDuplicates);
router.delete("/:id", auth, attachCompanyId, deleteAttendance);
module.exports = router;
