const express = require("express");
const router = express.Router();
const CompanySettings = require("../Modals/CompanySettings");
const fs = require("fs");
const path = require("path");
const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");

// GET SETTINGS
router.get("/", auth, attachCompanyId, async (req, res) => {
  try {
    const settings = await CompanySettings.findOne({ companyId: req.companyId });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// UPDATE SETTINGS (Fixed Toggle Logic)
router.put("/", auth, attachCompanyId, async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "..", "uploads", "logo");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    let authorizedPersons = [];
    if (req.body.authorizedPersons) {
      authorizedPersons = typeof req.body.authorizedPersons === "string" 
        ? JSON.parse(req.body.authorizedPersons) 
        : req.body.authorizedPersons;
    }

    // FIX: Boolean conversion for attendance toggles
    const updateData = {
      companyId: req.companyId,
      name: req.body.name || "",
      email: req.body.email || "",
      phone: req.body.phone || "",
      address: req.body.address || "",
      website: req.body.website || "",
      companyType: req.body.companyType || "",
      registrationNumber: req.body.registrationNumber || "",
      gstNumber: req.body.gstNumber || "",
      panNumber: req.body.panNumber || "",
      cinNumber: req.body.cinNumber || "",
      attendance: {
        gpsRequired: req.body.gpsRequired === "true" || req.body.gpsRequired === true,
        faceRequired: req.body.faceRequired === "true" || req.body.faceRequired === true, // Fixed logic
        lateMarkTime: req.body.lateMarkTime || "09:30",
        earlyLeaveTime: req.body.earlyLeaveTime || "17:30",
      },
      authorizedPersons: authorizedPersons,
    };

    if (req.files && req.files.logo) {
      const logoFile = req.files.logo;
      const fileName = `${Date.now()}_${logoFile.name}`;
      const savePath = path.join(uploadDir, fileName);
      await logoFile.mv(savePath);
      updateData.logo = `/static/logo/${fileName}`;
    }

    const settings = await CompanySettings.findOneAndUpdate(
      { companyId: req.companyId },
      updateData,
      { new: true, upsert: true }
    );

    res.json({ success: true, data: settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Update failed" });
  }
});

// REST OF THE DELETE ROUTES REMAIN SAME...
router.delete("/logo", auth, attachCompanyId, async (req, res) => {
  try {
    const settings = await CompanySettings.findOne({ companyId: req.companyId });
    if (settings?.logo) {
      const filePath = path.join(__dirname, "..", settings.logo.replace("/static", "uploads"));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      settings.logo = "";
      await settings.save();
    }
    res.json({ success: true, message: "Logo deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Logo delete failed" });
  }
});

module.exports = router;