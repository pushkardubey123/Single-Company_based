const express = require("express");
const router = express.Router();

const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");

const {
  addDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
  getPublicDepartments
} = require("../Controllers/departmentController");

// ADMIN
router.post("/", auth, attachCompanyId, addDepartment);
router.put("/:id", auth, attachCompanyId, updateDepartment);
router.delete("/:id", auth, attachCompanyId, deleteDepartment);
// ADMIN
router.get("/", auth, attachCompanyId, getDepartments);

// PUBLIC
router.get("/public", getPublicDepartments);



module.exports = router;
