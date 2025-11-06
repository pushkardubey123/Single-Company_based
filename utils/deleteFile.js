const fs = require("fs");
const path = require("path");

const deleteFile = (relativePath) => {
  const fullPath = path.join(__dirname, "..", "uploads", relativePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
};
module.exports = deleteFile;
