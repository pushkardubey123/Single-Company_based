const express = require("express");
const router = express.Router();
const CompanySettings = require("../Modals/CompanySettings");
const CompanySubscription = require("../Modals/SuperAdmin/CompanySubscription");
const fs = require("fs");
const path = require("path");
const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");
const checkPermission = require("../Middleware/checkPermission");
const checkSubscription = require("../Middleware/checkSubscription"); 

const MAX_FILE_SIZE = 2 * 1024 * 1024; 

router.get("/", auth, attachCompanyId, checkSubscription, async (req, res) => {
  try {
    const settings = await CompanySettings.findOne({ companyId: req.companyId });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/", auth, attachCompanyId, checkSubscription, checkPermission("settings", "edit"), async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "..", "uploads", "logo");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    let authorizedPersons = typeof req.body.authorizedPersons === "string" 
      ? JSON.parse(req.body.authorizedPersons) 
      : req.body.authorizedPersons || [];

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
        faceRequired: req.body.faceRequired === "true" || req.body.faceRequired === true,
        lateMarkTime: req.body.lateMarkTime || "09:30",
        earlyLeaveTime: req.body.earlyLeaveTime || "17:30",
      },
      authorizedPersons: authorizedPersons,
      
      // ✅ NAYA PAYROLL DATE UPDATE LOGIC
      payrollGenerationDate: Number(req.body.payrollGenerationDate) || 1,
    };

    let storageChangeMB = 0;

    if (req.files && req.files.logo) {
      const logoFile = req.files.logo;
      if (logoFile.size > MAX_FILE_SIZE) {
         return res.status(400).json({ success: false, message: "Logo size must be less than 2MB" });
      }

      const oldSettings = await CompanySettings.findOne({ companyId: req.companyId });
      if (oldSettings && oldSettings.logo) {
         const oldFilePath = path.join(__dirname, "..", oldSettings.logo.replace("/static", "uploads"));
         if (fs.existsSync(oldFilePath)) {
            storageChangeMB -= (fs.statSync(oldFilePath).size / (1024 * 1024));
            fs.unlinkSync(oldFilePath); 
         }
      }

      const fileName = `${Date.now()}_${logoFile.name}`;
      const savePath = path.join(uploadDir, fileName);
      await logoFile.mv(savePath);
      updateData.logo = `/static/logo/${fileName}`;
      
      storageChangeMB += (logoFile.size / (1024 * 1024));
    }

    const settings = await CompanySettings.findOneAndUpdate(
      { companyId: req.companyId },
      updateData,
      { new: true, upsert: true }
    );

    if (storageChangeMB !== 0) {
       await CompanySubscription.findOneAndUpdate(
         { companyId: req.companyId },
         { $inc: { "usage.storageUsedMB": storageChangeMB } }
       );
    }

    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: "Update failed" });
  }
});

router.delete("/logo", auth, attachCompanyId, checkSubscription, checkPermission("settings", "delete"), async (req, res) => {
  // (Your existing logo deletion logic remains exactly same here)
  try {
    const settings = await CompanySettings.findOne({ companyId: req.companyId });
    if (settings?.logo) {
      const filePath = path.join(__dirname, "..", settings.logo.replace("/static", "uploads"));
      let sizeToMinus = 0;
      if (fs.existsSync(filePath)) {
         sizeToMinus = fs.statSync(filePath).size / (1024 * 1024);
         fs.unlinkSync(filePath);
      }
      settings.logo = "";
      await settings.save();
      if(sizeToMinus > 0) {
        await CompanySubscription.findOneAndUpdate(
          { companyId: req.companyId },
          { $inc: { "usage.storageUsedMB": -sizeToMinus } }
        );
      }
    }
    res.json({ success: true, message: "Logo deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Logo delete failed" });
  }
});

module.exports = router;