const express = require("express");
const router = express.Router();
const authMiddleware = require("../Middleware/auth");
const { createEvent, getAllEvents, updateEvent, deleteEvent, gelOneEvent } = require("../Controllers/eventController");
const attachCompanyContext= require("../Middleware/companyMiddleware")


router.post("/create", authMiddleware,attachCompanyContext, createEvent);

router.get("/", authMiddleware,attachCompanyContext, getAllEvents);

router.put("/:id", authMiddleware,attachCompanyContext, updateEvent);

router.delete("/:id", authMiddleware,attachCompanyContext, deleteEvent);

router.get("/employee/:id", authMiddleware,attachCompanyContext,gelOneEvent);

module.exports = router;