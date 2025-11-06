const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const {
  addJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
} = require("../Controllers/jobController");

router.post("/", addJob);
router.get("/", getJobs);
router.get("/:id", getJobById);
router.put("/:id", auth, updateJob);
router.delete("/:id", auth, deleteJob);

module.exports = router;
