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
const { getMyLeaveBalance, getLeaveBalanceByEmployeeId, adjustLeaveBalance, runCarryForward} = require("../Controllers/Leave/LeaveBalanceController");
const applyMonthlyAccrual = require("../Service/applyMonthlyAccrual");

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
router.get("/balance/my-balance", authMiddleware, attachCompanyContext, getMyLeaveBalance);

// ✅ 2. Admin checks specific employee balance (Pass ID in URL)
router.get("/balance/employee/:employeeId", authMiddleware, attachCompanyContext, getLeaveBalanceByEmployeeId);

router.put("/balance/adjust", authMiddleware, attachCompanyContext, adjustLeaveBalance);
router.post(
  "/carry-forward",
  authMiddleware,
  attachCompanyContext,
  runCarryForward
);
router.post(
  "/apply-monthly-accrual",
  authMiddleware,
  attachCompanyContext,
  async (req, res) => {


    try {
      const { leaveTypeId } = req.body; // Frontend se aayega
await applyMonthlyAccrual(req.companyId, leaveTypeId);

      res.json({
        success: true,
        message: "Monthly accrual applied successfully",
      });
    } catch (err) {
      console.error("Monthly Accrual Error:", err);
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);


module.exports = router;
