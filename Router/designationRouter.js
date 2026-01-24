const express = require("express");
const router = express.Router();

const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");

const {
  addDesignation,
  getDesignations,
  updateDesignation,
  deleteDesignation,
  getPublicDesignations,
} = require("../Controllers/desinationController");

// ADMIN
router.post("/", auth, attachCompanyId, addDesignation);
router.get("/", auth, attachCompanyId, getDesignations);
router.put("/:id", auth, attachCompanyId, updateDesignation);
router.delete("/:id", auth, attachCompanyId, deleteDesignation);

// PUBLIC (REGISTER)
router.get("/public", getPublicDesignations);

module.exports = router;
