const express = require("express");
const router = express.Router();
const authMiddleware = require("../Middleware/auth");
const { createEvent, getAllEvents, updateEvent, deleteEvent, gelOneEvent } = require("../Controllers/eventController");


router.post("/create", authMiddleware, createEvent);

router.get("/", getAllEvents);

router.put("/:id", updateEvent);

router.delete("/:id", deleteEvent);

router.get("/employee/:id",gelOneEvent);

module.exports = router;