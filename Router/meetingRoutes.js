const express = require("express");
const router = express.Router();
const {
  createMeeting,
  getAllMeetings,
  updateMeeting,
  deleteMeeting,
} = require("../Controllers/meetingController");
const authMiddleware = require("../Middleware/auth");

router.post("/create", authMiddleware, createMeeting);
router.get("/all", getAllMeetings);
router.put("/update/:id", updateMeeting);
router.delete("/delete/:id", deleteMeeting);

module.exports = router;
