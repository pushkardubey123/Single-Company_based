const express = require("express");
const router = express.Router();
const CompanySettings = require("../Modals/CompanySettings");
const fs = require("fs");
const path = require("path");
const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");


router.get("/", auth, attachCompanyId, async (req, res) => {
  try {
    const settings = await CompanySettings.findOne({
      companyId: req.companyId,
    });

    res.json({ success: true, data: settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/", auth, attachCompanyId, async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "..", "uploads", "logo");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ====== AUTHORIZED PERSONS ======
let authorizedPersons = [];
if (req.body.authorizedPersons) {
  if (typeof req.body.authorizedPersons === "string") {
    authorizedPersons = JSON.parse(req.body.authorizedPersons);
  } else {
    authorizedPersons = req.body.authorizedPersons;
  }
}

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
    gpsRequired: req.body.gpsRequired === "true" || false,
    faceRequired: req.body.faceRequired === "true" || false,
    lateMarkTime: req.body.lateMarkTime || "09:30",
    earlyLeaveTime: req.body.earlyLeaveTime || "17:30",
  },
  authorizedPersons: authorizedPersons,
};


    /* ========= HANDLE LOGO ========= */
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

/* =======================
   DELETE ONLY LOGO
======================= */
router.delete("/logo", auth, attachCompanyId, async (req, res) => {
  try {
    const settings = await CompanySettings.findOne({
      companyId: req.companyId,
    });

    if (!settings?.logo) {
      return res.json({ success: false, message: "No logo found" });
    }

    const filePath = path.join(
      __dirname,
      "..",
      settings.logo.replace("/static", "uploads")
    );

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    settings.logo = "";
    await settings.save();

    res.json({ success: true, message: "Logo deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Logo delete failed" });
  }
});

/* =======================
   DELETE SINGLE FIELD
======================= */
router.delete("/:field", auth, attachCompanyId, async (req, res) => {
  try {
    const { field } = req.params;

    const allowedFields = [
      "name",
      "email",
      "phone",
      "address",
      "website",
      "companyType",
      "registrationNumber",
      "gstNumber",
      "panNumber",
      "cinNumber",
    ];

    if (!allowedFields.includes(field)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid field" });
    }

    const updateObj = {};
    updateObj[field] = "";

    const updated = await CompanySettings.findOneAndUpdate(
      { companyId: req.companyId },
      { $set: updateObj },
      { new: true }
    );

    res.json({ success: true, message: `${field} removed`, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

/* =======================
   RESET COMPANY SETTINGS
======================= */
router.delete("/", auth, attachCompanyId, async (req, res) => {
  try {
    const settings = await CompanySettings.findOne({
      companyId: req.companyId,
    });

    if (settings?.logo) {
      const filePath = path.join(
        __dirname,
        "..",
        settings.logo.replace("/static", "uploads")
      );
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const resetData = {
      companyId: req.companyId,
      name: "",
      email: "",
      phone: "",
      address: "",
      website: "",
      logo: "",
      companyType: "",
      registrationNumber: "",
      gstNumber: "",
      panNumber: "",
      cinNumber: "",
      attendance: {
        gpsRequired: true,
        faceRequired: false,
        lateMarkTime: "09:30",
        earlyLeaveTime: "17:30",
      },
      authorizedPersons: [],
    };

    const updated = await CompanySettings.findOneAndUpdate(
      { companyId: req.companyId },
      resetData,
      { new: true, upsert: true }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Reset failed" });
  }
});

module.exports = router;
