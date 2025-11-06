const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const {
  generateDynamicReport,
  getReports,
  getDashboardAnalytics,
} = require("../Controllers/reportController");

router.post("/generate", auth, generateDynamicReport);

router.get("/stream", generateDynamicReport);

router.get("/dashboard", auth, getDashboardAnalytics);

module.exports = router;
