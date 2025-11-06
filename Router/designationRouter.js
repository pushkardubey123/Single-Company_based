const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const {
  addDesignation,
  getDesignations,
  updateDesignation,
  deleteDesignation,
} = require("../Controllers/desinationController");

router.post("/", auth, addDesignation);
router.get("/", getDesignations);
router.put("/:id", auth, updateDesignation);
router.delete("/:id", auth, deleteDesignation);

module.exports = router;
