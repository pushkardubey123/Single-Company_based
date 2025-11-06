const Document = require("../Modals/Document");
const path = require("path");
const fs = require("fs");
const deleteFile = require("../utils/deleteFile");

exports.uploadDocument = async (req, res) => {
  try {
    const { employeeId, documentType } = req.body;

    if (!req.files || !req.files.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const file = req.files.file;
    const filename = Date.now() + "_" + file.name;
    const uploadPath = path.join(__dirname, "..", "uploads", "documents");

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const finalPath = path.join(uploadPath, filename);
    await file.mv(finalPath);

    const newDoc = new Document({
      employeeId,
      documentType,
      fileUrl: `documents/${filename}`,
      uploadedBy: req.user.id,
    });

    await newDoc.save();
    res
      .status(201)
      .json({ success: true, message: "Document uploaded", data: newDoc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const docs = await Document.find({ employeeId })
      .populate("uploadedBy", "name role")
      .populate("employeeId", "name email ")
      .sort({ uploadedAt: -1 });

    res.status(200).json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    deleteFile(doc.fileUrl);
    await Document.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: "Document deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.editDocumentType = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType } = req.body;

    const updated = await Document.findByIdAndUpdate(
      id,
      { documentType },
      { new: true }
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Document updated", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
