const express = require("express");
const router = express.Router();
const Branch = require("../Modals/Branch");
const auth = require("../Middleware/auth");

// Create Branch (Admin only)
router.post("/branch/create", auth, async (req, res) => {
  if (req.user.role !== "admin")
    return res.json({ success: false, message: "Access Denied" });

  try {
    const branch = await Branch.create(req.body);
    res.json({ success: true, message: "Branch Created", data: branch });
  } catch (err) {
    res.json({ success: false, message: "Error", error: err });
  }
});

// Get All Branches
router.get("/branch", async (req, res) => {
  try {
    const branches = await Branch.find();
    res.json({ success: true, data: branches });
  } catch {
    res.json({ success: false, message: "Error fetching branches" });
  }
});

router.put("/branch/update/:id", async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Branch updated successfully",
      data: branch,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to update branch",
      error: err.message,
    });
  }
});


// ========================== DELETE BRANCH ==========================
router.delete("/branch/delete/:id", async (req, res) => {
  try {
    const branch = await Branch.findByIdAndDelete(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Branch deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete branch",
      error: err.message,
    });
  }
});
module.exports = router;
