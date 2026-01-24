const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const attachCompanyId= require("../Middleware/companyMiddleware")
const {
  addJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  getPublicJobs,
} = require("../Controllers/jobController");


router.post("/",auth,attachCompanyId, addJob);
router.get("/",auth,attachCompanyId, getJobs);
router.put("/:id", auth,attachCompanyId, updateJob);
router.delete("/:id", auth,attachCompanyId, deleteJob);

router.get("/public/list", getPublicJobs);

router.get("/:id", getJobById);

module.exports = router;
