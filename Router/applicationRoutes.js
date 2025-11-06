const express = require("express");
const router = express.Router();
const {
  applyJob,
  getApplications,
  getApplicationById,
  rejectApplication,
  shortlistApplication,
} = require("../Controllers/applicationController");
const auth = require("../Middleware/auth");

router.post("/", applyJob);

router.get("/", auth, getApplications);
router.get("/:id", auth, getApplicationById);

router.put("/:id/reject", auth, rejectApplication);
router.put("/:id/shortlist", auth, shortlistApplication);

module.exports = router;
