const router = require("express").Router();
const auth = require("../Middleware/auth");
const {
  createExitRequest,
  getAllExitRequests,
  getExitRequestsByEmployee,
  updateExitRequestByAdmin,
  deleteExitRequest,
} = require("../Controllers/exitController");

router.post("/submit", auth, createExitRequest);
router.get("/my-requests", auth, getExitRequestsByEmployee);
router.get("/", auth, getAllExitRequests);
router.put("/:id", auth, updateExitRequestByAdmin);
router.delete("/:id", auth, deleteExitRequest);
module.exports = router;
