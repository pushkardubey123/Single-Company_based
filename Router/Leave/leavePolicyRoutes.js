const express = require("express");
const router = express.Router();
const auth = require("../../Middleware/auth");

const {
  getLeavePolicies,
  createLeavePolicy,
  updateLeavePolicy,
  deleteLeavePolicy,
} = require("../../Controllers/Leave/leavePolicyController");
const companyMiddleware = require("../../Middleware/companyMiddleware");

router.get("/", auth,companyMiddleware, getLeavePolicies);
router.post("/", auth,companyMiddleware, createLeavePolicy);
router.put("/:id", auth,companyMiddleware, updateLeavePolicy);
router.delete("/:id", auth,companyMiddleware, deleteLeavePolicy);

module.exports = router;
