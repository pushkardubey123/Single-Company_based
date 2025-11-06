const express = require("express");
const router = express.Router();
const {
  uploadDocument,
  getDocuments,
  deleteDocument,
  editDocumentType,
} = require("../Controllers/documentController");
const auth = require("../Middleware/auth");

router.post("/upload", auth, uploadDocument);
router.get("/:employeeId", auth, getDocuments);
router.delete("/:id", auth, deleteDocument);
router.put("/:id", auth, editDocumentType);

module.exports = router;
