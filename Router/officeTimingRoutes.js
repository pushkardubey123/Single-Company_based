const router = require("express").Router();
const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");
const {
  saveTiming,
  getTiming,
} = require("../Controllers/officeTimingController");

router.get("/timing", auth, attachCompanyId, getTiming);
router.post("/timing", auth, attachCompanyId, saveTiming);

module.exports = router;
