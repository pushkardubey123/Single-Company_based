const express = require("express");
const router = express.Router();
const Branch = require("../Modals/Branch");
const auth = require("../Middleware/auth");
const attachCompanyId= require("../Middleware/companyMiddleware")

router.post("/branch/create", auth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.json({ success: false, message: "Access Denied" });
  }

  try {
    const branch = await Branch.create({
      ...req.body,
      companyId: req.user.id, 
    });

    res.json({ success: true, message: "Branch Created", data: branch });
  } catch (err) {
    res.json({
      success: false,
      message: err.code === 11000
        ? "Branch already exists for this company"
        : "Error creating branch",
    });
  }
});


router.get("/branch", auth,attachCompanyId, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access Denied",
      });
    }

    const branches = await Branch.find({
      companyId: req.companyId, 
    });

    res.json({ success: true, data: branches });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching branches",
    });
  }
});

router.get("/public/branches/:companyId", async (req, res) => {
  try {
    const branches = await Branch.find({
      companyId: req.params.companyId,
    }).select("name");

    res.json({ success: true, data: branches });
  } catch (err) {
    res.json({ success: false, message: "Failed to fetch branches" });
  }
});


router.put("/branch/update/:id", auth, async (req, res) => {
  try {
    const branch = await Branch.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user._id },
      req.body,
      { new: true }
    );

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found or unauthorized",
      });
    }

    res.json({
      success: true,
      message: "Branch updated successfully",
      data: branch,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update branch",
    });
  }
});


router.delete("/branch/delete/:id", auth, async (req, res) => {
  try {
    const branch = await Branch.findOneAndDelete({
      _id: req.params.id,
      companyId: req.user.id,
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found or unauthorized",
      });
    }

    res.json({
      success: true,
      message: "Branch deleted successfully",
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to delete branch",
    });
  }
});

// Public – Branch by Company
router.get("/public/branches/:companyId", async (req, res) => {
  try {
    const branches = await Branch.find({
      companyId: req.params.companyId,
    }).select("name");

    res.json({ success: true, data: branches });
  } catch {
    res.json({ success: false, message: "Failed to fetch branches" });
  }
});

module.exports = router;
