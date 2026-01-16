const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const {
  generateDynamicReport,
  getReports,
  getDashboardAnalytics,
} = require("../Controllers/reportController");
const attachCompanyId = require('../Middleware/companyMiddleware')

router.post("/generate", auth, generateDynamicReport);

router.get("/stream", generateDynamicReport);

router.get("/dashboard", auth, attachCompanyId, getDashboardAnalytics);

module.exports = router;
