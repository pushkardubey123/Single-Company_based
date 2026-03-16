const Asset = require("../Modals/Asset/Asset");
const AssetAssignment = require("../Modals/Asset/AssetAssignment");
const OnboardingRule = require("../Modals/Asset/OnboardingRule");

/* ====================================================
   PART 1: ASSET INVENTORY MANAGEMENT (IT ADMIN/HR)
==================================================== */

const createAsset = async (req, res) => {
  try {
    const { assetName, category, serialNumber, purchaseDate, warrantyExpiry, cost, description, branchId, assetType, quantity } = req.body;

    if (assetType === "Unique" && !serialNumber) {
      return res.status(400).json({ success: false, message: "Serial Number is required for Unique assets!" });
    }

    if (assetType === "Unique" && serialNumber) {
      const existingSN = await Asset.findOne({ companyId: req.companyId, serialNumber });
      if (existingSN) return res.status(400).json({ success: false, message: "This Serial Number already exists!" });
    } else if (assetType === "Bulk") {
      const existingBulk = await Asset.findOne({ companyId: req.companyId, assetName, assetType: "Bulk" });
      if (existingBulk) return res.status(400).json({ success: false, message: "This Bulk item already exists! Please use the Edit button to update its stock." });
    }

    const newAsset = await Asset.create({
      companyId: req.companyId,
      branchId: branchId || req.user.branchId,
      assetName, category, serialNumber: assetType === "Unique" ? serialNumber : undefined, 
      purchaseDate, warrantyExpiry, cost, description,
      assetType: assetType || "Unique",
      quantity: assetType === "Bulk" ? (quantity || 1) : 1,
      status: "Available"
    });

    res.status(201).json({ success: true, message: "Asset added successfully", data: newAsset });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to add asset" });
  }
};

const updateAsset = async (req, res) => {
  try {
    const { quantity, assetName, serialNumber, status, category } = req.body;
    const updatedAsset = await Asset.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { quantity, assetName, serialNumber, status, category },
      { new: true }
    );
    res.json({ success: true, message: "Asset updated successfully", data: updatedAsset });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update asset" });
  }
};

// 🔥 Delete API Add ho gayi hai
const deleteAsset = async (req, res) => {
  try {
    const deleted = await Asset.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!deleted) return res.status(404).json({ success: false, message: "Asset not found" });
    res.json({ success: true, message: "Asset deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete asset" });
  }
};

const getAllAssets = async (req, res) => {
  try {
    const { status, category, branchId } = req.query;
    const filter = { companyId: req.companyId };
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (req.user.role !== "admin") filter.branchId = req.user.branchId;
    if (branchId) filter.branchId = branchId;

    const assets = await Asset.find(filter).populate("branchId", "name").sort({ createdAt: -1 });
    res.json({ success: true, data: assets });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/* ====================================================
   PART 2: ASSET ASSIGNMENT & WORKFLOW (TICKETS)
==================================================== */

const getAllAssignments = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { companyId: req.companyId };
    if (status) filter.status = status;
    if (req.user.role !== "admin") filter.branchId = req.user.branchId;

    const assignments = await AssetAssignment.find(filter)
      .populate("employeeId", "name email profilePic")
      .populate("assetId", "assetName serialNumber category assetType quantity")
      .populate("assignedBy", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: assignments });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const assignAssetToEmployee = async (req, res) => {
  try {
    const { assignmentId, assetId, conditionOnIssue, notes } = req.body;

    const assignment = await AssetAssignment.findOne({ _id: assignmentId, companyId: req.companyId });
    if (!assignment) return res.status(404).json({ success: false, message: "Request ticket not found" });

    const asset = await Asset.findOne({ _id: assetId, companyId: req.companyId });
    if (!asset) return res.status(404).json({ success: false, message: "Asset not found in inventory" });

    if (asset.assetType === "Unique" && asset.status !== "Available") {
      return res.status(400).json({ success: false, message: `This specific asset is currently marked as ${asset.status}` });
    }
    if (asset.assetType === "Bulk" && asset.quantity <= 0) {
      return res.status(400).json({ success: false, message: "This item is Out of Stock!" });
    }

    assignment.assetId = asset._id;
    assignment.assignedBy = req.user._id;
    assignment.issueDate = new Date();
    assignment.status = "Assigned";
    assignment.conditionOnIssue = conditionOnIssue || "Good";
    if (notes) assignment.notes = notes;
    await assignment.save();

    if (asset.assetType === "Bulk") {
      asset.quantity -= 1;
      if (asset.quantity === 0) asset.status = "Out of Stock";
    } else {
      asset.status = "Assigned";
    }
    await asset.save();

    res.json({ success: true, message: "Asset assigned & Inventory updated successfully!", data: assignment });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to assign asset" });
  }
};

const returnAsset = async (req, res) => {
  try {
    const { assignmentId, conditionOnReturn, returnNotes } = req.body;

    const assignment = await AssetAssignment.findOne({ _id: assignmentId, companyId: req.companyId });
    if (!assignment || assignment.status !== "Assigned") {
      return res.status(400).json({ success: false, message: "Valid assigned record not found." });
    }

    assignment.status = "Returned";
    assignment.returnDate = new Date();
    assignment.conditionOnReturn = conditionOnReturn || "Good";
    if (returnNotes) assignment.notes = assignment.notes ? `${assignment.notes} | Return Note: ${returnNotes}` : `Return Note: ${returnNotes}`;
    await assignment.save();

    const asset = await Asset.findById(assignment.assetId);
    if (asset) {
      if (asset.assetType === "Bulk") {
        asset.quantity += 1;
        if (asset.status === "Out of Stock") asset.status = "Available";
      } else {
        if (conditionOnReturn === "Damaged" || conditionOnReturn === "Needs Repair") {
          asset.status = "Under Maintenance";
        } else {
          asset.status = "Available";
        }
      }
      await asset.save();
    }

    res.json({ success: true, message: "Asset returned successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to process asset return" });
  }
};

/* ====================================================
   PART 3: EMPLOYEE PORTAL APIs
==================================================== */

const getMyAssets = async (req, res) => {
  try {
    const myAssets = await AssetAssignment.find({ employeeId: req.user._id, companyId: req.companyId })
      .populate("assetId", "assetName serialNumber category assetType quantity")
      .sort({ issueDate: -1 });
    res.json({ success: true, data: myAssets });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getAvailableAssetNames = async (req, res) => {
  try {
    const assets = await Asset.find({ companyId: req.companyId }).select("assetName category assetType");
    
    // Duplicate naam hatane ke liye (Agar 10 iPhone 15 hain toh dropdown me 1 hi dikhe)
    const uniqueAssets = [];
    const seen = new Set();
    assets.forEach(a => {
      if (!seen.has(a.assetName)) {
        seen.add(a.assetName);
        uniqueAssets.push({ assetName: a.assetName, category: a.category, assetType: a.assetType });
      }
    });
    
    res.json({ success: true, data: uniqueAssets });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 🔥 UPDATE: Admin panel me naam dikhane ke liye requestedAssetName add kiya
const requestAssetManual = async (req, res) => {
  try {
    const { requestedAssetName, requestedAssetType, requestedCategory, notes } = req.body;
    
    const newRequest = await AssetAssignment.create({
      companyId: req.companyId,
      branchId: req.user.branchId,
      employeeId: req.user._id,
      issueDate: new Date(),
      status: "Requested",
      requestedAssetName: requestedAssetName, // Yeh Admin panel me show hoga
      requestedAssetType: requestedAssetType || "Unique",
      requestedCategory: requestedCategory || "Other",
      notes: notes || `Manual request for ${requestedAssetName}`,
    });
    
    res.status(201).json({ success: true, message: "Asset request submitted", data: newRequest });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to submit request" });
  }
};

/* ====================================================
   PART 4: SETTINGS (ONBOARDING RULES)
==================================================== */

const getOnboardingRules = async (req, res) => {
  try {
    const rules = await OnboardingRule.find({ companyId: req.companyId });
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch rules" });
  }
};

const createOnboardingRule = async (req, res) => {
  try {
    const { assetName, assetType } = req.body;
    const newRule = await OnboardingRule.create({ companyId: req.companyId, assetName, assetType });
    res.json({ success: true, data: newRule });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create rule" });
  }
};

const deleteOnboardingRule = async (req, res) => {
  try {
    await OnboardingRule.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    res.json({ success: true, message: "Rule deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete rule" });
  }
};

module.exports = {
  createAsset, updateAsset, deleteAsset, getAllAssets, getAllAssignments, assignAssetToEmployee,getAvailableAssetNames, returnAsset, getMyAssets, requestAssetManual, getOnboardingRules, createOnboardingRule, deleteOnboardingRule,
};