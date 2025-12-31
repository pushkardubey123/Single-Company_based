const express = require("express");
const router = express.Router();

const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");

const {
  createPayroll,
  getAllPayrolls,
  getPayrollById,
  updatePayroll,
  deletePayroll,
  getPayrollByEmployeeId,
  getMyPayrolls
} = require("../Controllers/PayrollController");

router.post("/", auth, attachCompanyId, createPayroll);
router.get("/", auth, attachCompanyId, getAllPayrolls);
router.get("/employee/:id", auth, attachCompanyId, getPayrollByEmployeeId);
router.get("/my", auth, attachCompanyId, getMyPayrolls);
router.get("/:id", auth, attachCompanyId, getPayrollById);
router.put("/:id", auth, attachCompanyId, updatePayroll);
router.delete("/:id", auth, attachCompanyId, deletePayroll);

module.exports = router;
