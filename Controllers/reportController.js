const Report = require("../Modals/Reports");
const PDFDocument = require("pdfkit");
const Attendance = require("../Modals/Attendence");
const Leave = require("../Modals/Leave");
const User = require("../Modals/User");
const Exit = require("../Modals/ExitRequest");
const Project = require("../Modals/Project");

const streamReportDirectly = (res, type, data) => {
  const doc = new PDFDocument({ margin: 30 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=${type}_report.pdf`);

  doc.pipe(res);
  doc
    .fillColor("#1F4E79")
    .fontSize(20)
    .text(`${type.toUpperCase()} REPORT`, { align: "center" })
    .moveDown();
  const headingsMap = {
    attendance: ["#", "Name", "Email", "Date", "Status"],
    leaves: ["#", "Name", "Email", "Leave Type", "Start", "End", "Status"],
    users: ["#", "Name", "Email", "Phone", "Department"],
    exit: ["#", "Name", "Email", "Reason", "Date", "Status"],
    projects: ["#", "Name", "Status", "Start", "End", "Total Tasks"],
  };

  const headers = headingsMap[type] || [];
  doc.fontSize(12).font("Helvetica-Bold").text(headers.join(" | ")).moveDown();

  doc.font("Helvetica").fontSize(10);

  data.forEach((item, i) => {
    let row = `${i + 1}`;
    if (type === "attendance") {
      row += ` | ${item.name} | ${item.email} | ${item.date} | ${item.status}`;
    } else if (type === "leaves") {
      row += ` | ${item.name} | ${item.email} | ${item.leaveType} | ${item.start} | ${item.end} | ${item.status}`;
    } else if (type === "users") {
      row += ` | ${item.name} | ${item.email} | ${item.phone} | ${item.department}`;
    } else if (type === "exit") {
      row += ` | ${item.name} | ${item.email} | ${item.reason} | ${item.date} | ${item.status}`;
    } else if (type === "projects") {
      row += ` | ${item.name} | ${item.status} | ${item.start} | ${item.end} | ${item.tasks}`;
    }
    doc.text(row).moveDown(0.2);
  });

  doc.end();
};

const generateDynamicReport = async (req, res) => {
  try {
    const { type } = req.query;
    let data = [];

    if (type === "attendance") {
      const attendance = await Attendance.find().populate(
        "employeeId",
        "name email"
      );
      data = attendance.map((a) => ({
        name: a.employeeId?.name || "-",
        email: a.employeeId?.email || "-",
        date: new Date(a.date).toDateString(),
        status: a.status,
      }));
    } else if (type === "leaves") {
      const leaves = await Leave.find().populate("employeeId", "name email");
      data = leaves.map((l) => ({
        name: l.employeeId?.name || "-",
        email: l.employeeId?.email || "-",
        leaveType: l.leaveType,
        start: new Date(l.startDate).toDateString(),
        end: new Date(l.endDate).toDateString(),
        status: l.status,
      }));
    } else if (type === "users") {
      const users = await User.find({ role: "employee" }).populate(
        "departmentId",
        "name"
      );
      data = users.map((u) => ({
        name: u.name,
        email: u.email,
        phone: u.phone,
        department: u.departmentId?.name || "-",
      }));
    } else if (type === "exit") {
      const exits = await Exit.find().populate("employeeId", "name email");
      data = exits.map((e) => ({
        name: e.employeeId?.name || "-",
        email: e.employeeId?.email || "-",
        reason: e.reason,
        date: new Date(e.resignationDate).toDateString(),
        status: e.clearanceStatus || "Pending",
      }));
    } else if (type === "projects") {
      const projects = await Project.find();
      data = projects.map((p) => ({
        name: p.name,
        status: p.status,
        start: p.startDate?.toDateString() || "-",
        end: p.endDate?.toDateString() || "-",
        tasks: p.tasks.length,
      }));
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid report type" });
    }

    streamReportDirectly(res, type, data);
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate("generatedBy", "name email")
      .sort({ generatedAt: -1 });

    const formattedReports = reports.map((report) => ({
      _id: report._id,
      type: report.type,
      fileUrl: report.fileUrl,
      filterParams: report.filterParams,
      generatedAt: report.generatedAt,
      generatedBy: report.generatedBy
        ? {
            name: report.generatedBy.name,
            email: report.generatedBy.email,
          }
        : null,
    }));

    res.json({ success: true, data: formattedReports });
  } catch {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch reports" });
  }
};

const getDashboardAnalytics = async (req, res) => {
  try {
    const [
      employeeCount,
      leaveCount,
      attendanceCount,
      exitCount,
      todayAttendance,
      projectCount,
    ] = await Promise.all([
      User.countDocuments({ role: "employee" }),
      Leave.countDocuments(),
      Attendance.countDocuments(),
      Exit.countDocuments(),
      Attendance.countDocuments({
        date: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      }),
      Project.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        totalEmployees: employeeCount,
        totalLeaves: leaveCount,
        totalAttendance: attendanceCount,
        todayAttendance,
        totalProjects: projectCount,
        exitRequests: exitCount,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Analytics error" });
  }
};

module.exports = {
  generateDynamicReport,
  getReports,
  getDashboardAnalytics,
  streamReportDirectly,
};
