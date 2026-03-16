const router = require("express").Router();
const auth = require("../Middleware/auth"); 
const attachCompanyId = require("../Middleware/companyMiddleware"); 
const checkPermission = require("../Middleware/checkPermission"); 

const {
  createAsset,
  updateAsset,
  deleteAsset,
  getAllAssets,
  getAllAssignments,
  assignAssetToEmployee,
  returnAsset,
  getMyAssets,
  requestAssetManual,
  createOnboardingRule,
  deleteOnboardingRule,
  getOnboardingRules,
  getAvailableAssetNames
} = require("../Controllers/AssetController");

// Employee Self Service
router.get("/my-assets", auth, attachCompanyId, getMyAssets);
router.post("/request", auth, attachCompanyId, requestAssetManual);
router.get("/available-names", auth, attachCompanyId, getAvailableAssetNames);

// IT Inventory Management
router.post("/inventory", auth, attachCompanyId, checkPermission("asset_management", "create"), createAsset);
router.get("/inventory", auth, attachCompanyId, checkPermission("asset_management", "view"), getAllAssets);
router.put("/inventory/:id", auth, attachCompanyId, checkPermission("asset_management", "edit"), updateAsset);
router.delete("/inventory/:id", auth, attachCompanyId, checkPermission("asset_management", "delete"), deleteAsset);

// Assignments Workflow
router.get("/assignments", auth, attachCompanyId, checkPermission("asset_management", "view"), getAllAssignments);
router.post("/assign", auth, attachCompanyId, checkPermission("asset_management", "edit"), assignAssetToEmployee);
router.post("/return", auth, attachCompanyId, checkPermission("asset_management", "edit"), returnAsset);

// Settings (Onboarding Rules)
router.get("/rules", auth, attachCompanyId, getOnboardingRules);
router.post("/rules", auth, attachCompanyId, checkPermission("asset_management", "create"), createOnboardingRule);
router.delete("/rules/:id", auth, attachCompanyId, checkPermission("asset_management", "delete"), deleteOnboardingRule);

module.exports = router;