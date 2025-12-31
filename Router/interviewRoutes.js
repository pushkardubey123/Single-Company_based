const express = require("express");
const router = express.Router();
const {
  scheduleInterview,
  getAllInterviews,
  getInterviewById,
  updateInterview,
  deleteInterview,
} = require("../Controllers/InterviewController");
const auth = require("../Middleware/auth");
const attachCompanyId= require("../Middleware/companyMiddleware")

router.post("/schedule", auth,attachCompanyId, scheduleInterview);
router.get("/", auth,attachCompanyId, getAllInterviews);
router.get("/:id", auth,attachCompanyId, getInterviewById);
router.put("/:id", auth,attachCompanyId, updateInterview);
router.delete("/:id", auth,attachCompanyId, deleteInterview);

module.exports = router;
