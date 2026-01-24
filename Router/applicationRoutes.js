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
const attachCompanyId = require("../Middleware/companyMiddleware")

router.post("/", applyJob);

router.get("/", auth,attachCompanyId, getApplications);
router.get("/:id", auth,attachCompanyId, getApplicationById);

router.put("/:id/reject", auth,attachCompanyId, rejectApplication);
router.put("/:id/shortlist", auth,attachCompanyId, shortlistApplication);

module.exports = router;
