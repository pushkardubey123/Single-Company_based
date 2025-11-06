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

router.post("/wfh/apply", auth, applyWFH);
router.get("/wfh/my", auth, getMyWFH);

router.get("/wfh/all", auth, getAllWFH);
router.put("/wfh/status/:id", auth, updateWFHStatus);
router.post("/admin/assign-wfh", auth, adminAssignWFH);

module.exports = router;
