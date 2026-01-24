const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const headingsMap = {
  attendance: ["#", "Name", "Email", "Date", "Status"],
  leaves: ["#", "Name", "Email", "Leave Type", "Start", "End", "Status"],
  users: ["#", "Name", "Email", "Phone", "Department"],
  exit: ["#", "Name", "Email", "Reason", "Date", "Status"],
  projects: ["#", "Name", "Status", "Start", "End", "Total Tasks"],
};

const generateReport = async (type, data = [], filename) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30 });

      const filePath = path.join(filename);
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc
        .fillColor("#1F4E79")
        .fontSize(20)
        .text(`${type.toUpperCase()} REPORT`, { align: "center" })
        .moveDown(0.5);

      doc
        .fontSize(10)
        .fillColor("gray")
        .text(`Generated on: ${new Date().toLocaleString()}`, {
          align: "right",
        })
        .moveDown();

      const headers = headingsMap[type];
      if (!headers) {
        doc.text("Unknown report type");
        doc.end();
        return resolve(filePath);
      }

      doc
        .fontSize(12)
        .fillColor("#000")
        .font("Helvetica-Bold")
        .text(headers.join(" | "))
        .moveDown(0.5);

      doc.font("Helvetica").fontSize(11).fillColor("#000");

      data.forEach((item, i) => {
        let row = `${i + 1}`;
        if (type === "users") {
          row += ` | ${item.name} | ${item.email} | ${item.phone} | ${item.department}`;
        } else if (type === "attendance") {
          row += ` | ${item.name} | ${item.email} | ${item.date} | ${item.status}`;
        } else if (type === "leaves") {
          row += ` | ${item.name} | ${item.email} | ${item.leaveType} | ${item.start} | ${item.end} | ${item.status}`;
        } else if (type === "exit") {
          row += ` | ${item.name} | ${item.email} | ${item.reason} | ${item.date} | ${item.status}`;
        } else if (type === "projects") {
          row += ` | ${item.name} | ${item.status} | ${item.start} | ${item.end} | ${item.tasks}`;
        }

        doc.text(row).moveDown(0.2);
      });

      doc.end();

      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = generateReport;
