const express = require("express");
const router = express.Router();
const {
  createMeeting,
  getAllMeetings,
  updateMeeting,
  deleteMeeting,
} = require("../Controllers/meetingController");
const authMiddleware = require("../Middleware/auth");
const attachCompanyContext = require("../Middleware/companyMiddleware");

router.post("/create", authMiddleware, attachCompanyContext, createMeeting);
router.get("/all", authMiddleware, attachCompanyContext, getAllMeetings);
router.put("/update/:id", authMiddleware, attachCompanyContext, updateMeeting);
router.delete("/delete/:id", authMiddleware, attachCompanyContext, deleteMeeting);


module.exports = router;
