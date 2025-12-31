const express = require("express");
const router = express.Router();
const leadController = require("../Controllers/leadController");
const verifyToken = require("../Middleware/auth");

router.post("/create", verifyToken, leadController.createLead);
router.post("/auto", leadController.autoCreateLead); 
router.get("/", verifyToken, leadController.getAllLeads);
router.post("/activity", verifyToken, leadController.addLeadActivity);
router.post("/convert/:id", verifyToken, leadController.convertLeadToProject);
router.put("/status", verifyToken, leadController.updateLeadStatus);
router.get("/activity/:leadId", verifyToken, async (req, res) => {
  const data = await LeadActivity.find({ leadId: req.params.leadId })
    .populate("employeeId", "name");
  res.json({ success: true, data });
});


module.exports = router;
