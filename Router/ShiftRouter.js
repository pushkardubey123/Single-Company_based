const express = require("express");
const router = express.Router();

const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");

const {
  addShift,
  updateShift,
  deleteShift,
  getAdminShifts,
  getPublicShifts,
} = require("../Controllers/ShiftController");

// ADMIN
router.post("/", auth, attachCompanyId, addShift);
router.put("/:id", auth, attachCompanyId, updateShift);
router.delete("/:id", auth, attachCompanyId, deleteShift);

// ADMIN (LOGIN REQUIRED)
router.get("/admin", auth, attachCompanyId, getAdminShifts);

// PUBLIC (REGISTER PAGE)
router.get("/", getPublicShifts);


module.exports = router;
