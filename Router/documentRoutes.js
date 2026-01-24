const express = require("express");
const router = express.Router();
const {
  uploadDocument,
  getDocuments,
  deleteDocument,
  editDocumentType,
} = require("../Controllers/documentController");
const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware")

router.post("/upload", auth, attachCompanyId, uploadDocument);
router.get("/:employeeId", auth, attachCompanyId, getDocuments);
router.delete("/:id", auth, attachCompanyId, deleteDocument);
router.put("/:id", auth, attachCompanyId, editDocumentType);


module.exports = router;
