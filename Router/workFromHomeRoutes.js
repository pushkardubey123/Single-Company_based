const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const {
  applyWFH,
  getMyWFH,
  getAllWFH,
  updateWFHStatus,
  adminAssignWFH,
} = require("../Controllers/workFromHomeController");
const attachCompanyId = require("../Middleware/companyMiddleware")

router.post("/wfh/apply", auth, attachCompanyId, applyWFH);

router.get("/wfh/my", auth, attachCompanyId, getMyWFH);

router.get("/wfh/all", auth, attachCompanyId, getAllWFH);

router.put("/wfh/status/:id", auth, attachCompanyId, updateWFHStatus);

router.post("/admin/assign-wfh", auth, attachCompanyId, adminAssignWFH);


module.exports = router;
