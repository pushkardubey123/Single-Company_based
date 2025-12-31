const router = require("express").Router();
const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");

const {
  createExitRequest,
  getAllExitRequests,
  getExitRequestsByEmployee,
  updateExitRequestByAdmin,
  deleteExitRequest,
} = require("../Controllers/exitController");

router.post("/submit", auth, attachCompanyId, createExitRequest);
router.get("/my-requests", auth, attachCompanyId, getExitRequestsByEmployee);
router.get("/", auth, attachCompanyId, getAllExitRequests);
router.put("/:id", auth, attachCompanyId, updateExitRequestByAdmin);
router.delete("/:id", auth, attachCompanyId, deleteExitRequest);

module.exports = router;
