const express = require("express");
const router = express.Router();
const CompanySettings = require("../Modals/CompanySettings");
const fs = require("fs");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/logo";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  }
});

const upload = multer({ storage });

// GET settings
router.get("/", async (req, res) => {
  const data = await CompanySettings.findOne();
  res.json({ success: true, data });
});

// UPDATE settings
router.put("/", upload.single("logo"), async (req, res) => {
  let updateData = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    address: req.body.address,
    website: req.body.website,
  };

  if (req.file) {
    updateData.logo = `/static/logo/${req.file.filename}`;
  }

  const settings = await CompanySettings.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });

  res.json({ success: true, data: settings });
});

// DELETE LOGO
router.delete("/logo", async (req, res) => {
  try {
    const settings = await CompanySettings.findOne();
    if (!settings || !settings.logo) {
      return res.json({ success: false, message: "No logo found to delete." });
    }

    const filePath = `.${settings.logo.replace("/static", "/uploads")}`;

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    settings.logo = "";
    await settings.save();

    res.json({ success: true, message: "Logo deleted successfully!" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// DELETE single field
router.delete("/:field", async (req, res) => {
  try {
    const { field } = req.params;

    const validFields = ["name", "email", "phone", "address", "website", "logo"];

    if (!validFields.includes(field)) {
      return res.status(400).json({ success: false, message: "Invalid field" });
    }

    const settings = await CompanySettings.findOne();

    // If deleting logo → delete file also
    if (field === "logo" && settings?.logo) {
      const filePath = path.join(__dirname, "..", settings.logo.replace("/static", "uploads"));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // Update only selected field
    const updateObj = {};
    updateObj[field] = "";

    const updated = await CompanySettings.findOneAndUpdate({}, updateObj, {
      new: true,
      upsert: true,
    });

    res.json({ success: true, message: `${field} removed`, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error deleting field" });
  }
});

router.delete("/", async (req, res) => {
  try {
    const settings = await CompanySettings.findOne();

    if (settings?.logo) {
      const filePath = path.join(__dirname, "..", settings.logo.replace("/static", "uploads"));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const emptyData = {
      name: "",
      email: "",
      phone: "",
      address: "",
      website: "",
      logo: ""
    };

    const newSettings = await CompanySettings.findOneAndUpdate({}, emptyData, {
      new: true,
      upsert: true,
    });

    res.json({ success: true, data: newSettings });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error resetting settings" });
  }
});

module.exports = router;
