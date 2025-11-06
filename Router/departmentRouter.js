const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const {
  addDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
} = require("../Controllers/departmentController");

router.post("/", auth, addDepartment);
router.get("/", getDepartments);
router.put("/:id", auth, updateDepartment);
router.delete("/:id", auth, deleteDepartment);

module.exports = router;
