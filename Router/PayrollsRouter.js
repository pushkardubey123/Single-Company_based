const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const {
  createPayroll,
  getAllPayrolls,
  getPayrollById,
  updatePayroll,
  deletePayroll,
  getPayrollByEmployeeId,
} = require("../Controllers/PayrollController");

router.post("/", auth, createPayroll);
router.get("/", auth, getAllPayrolls);
router.get("/employee/:id", auth, getPayrollByEmployeeId);
router.get("/:id", auth, getPayrollById);
router.put("/:id", auth, updatePayroll);
router.delete("/:id", auth, deletePayroll);

module.exports = router;
