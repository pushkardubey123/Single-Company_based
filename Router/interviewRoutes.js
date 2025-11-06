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

router.post("/schedule", auth, scheduleInterview);
router.get("/", auth, getAllInterviews);
router.get("/:id", auth, getInterviewById);
router.put("/:id", auth, updateInterview);
router.delete("/:id", auth, deleteInterview);

module.exports = router;
