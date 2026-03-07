const Report = require("../Modals/Reports");
const PDFDocument = require("pdfkit");
const Attendance = require("../Modals/Attendance"); // Apna correct spelling check kar lein
const Leave = require("../Modals/Leave");
const User = require("../Modals/User");
const Exit = require("../Modals/ExitRequest");
const Project = require("../Modals/Project");
const moment = require("moment-timezone");

const streamReportDirectly = (res, type, data, monthStr) => {
  // Monthly Attendance needs landscape mode for 31 columns
  const isLandscape = type === "attendance";
  const doc = new PDFDocument({ 
      margin: 30, 
      size: 'A4', 
      layout: isLandscape ? 'landscape' : 'portrait' 
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=${type}_report.pdf`);

  doc.pipe(res);

  // --- HEADER SECTION ---
  doc.fillColor("#1F4E79")
     .fontSize(20)
     .text(`${type.toUpperCase()} REPORT`, { align: "center" });
     
  if (type === "attendance" && monthStr) {
      doc.fontSize(12).fillColor("#64748b").text(`Month: ${monthStr}`, { align: "center" }).moveDown(2);
  } else {
      doc.moveDown(2);
  }

  // --- ATTENDANCE (GRID/MATRIX UI) ---
  if (type === "attendance") {
      drawMonthlyAttendanceTable(doc, data, monthStr);
  } 
  // --- NORMAL LIST REPORTS ---
  else {
      // Baki reports ka purana logic...
      const headingsMap = {
        leaves: ["#", "Name", "Leave Type", "Start Date", "End Date", "Status"],
        users: ["#", "Name", "Email", "Phone", "Department"],
        exit: ["#", "Name", "Reason", "Date", "Status"],
        projects: ["#", "Name", "Status", "Start", "End", "Total Tasks"],
      };

      const headers = headingsMap[type] || [];
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000").text(headers.join("  |  ")).moveDown(0.5);
      doc.moveTo(30, doc.y).lineTo(560, doc.y).strokeColor("#cccccc").stroke().moveDown(0.5);

      doc.font("Helvetica").fontSize(9);
      data.forEach((item, i) => {
        let row = `${i + 1}`;
        if (type === "leaves") row += `  |  ${item.name} | ${item.leaveType} | ${item.start} | ${item.end} | ${item.status}`;
        else if (type === "users") row += `  |  ${item.name} | ${item.email} | ${item.phone} | ${item.department}`;
        else if (type === "exit") row += `  |  ${item.name} | ${item.reason} | ${item.date} | ${item.status}`;
        else if (type === "projects") row += `  |  ${item.name} | ${item.status} | ${item.start} | ${item.end} | ${item.tasks}`;
        doc.text(row).moveDown(0.5);
        doc.moveTo(30, doc.y).lineTo(560, doc.y).strokeColor("#eeeeee").stroke().moveDown(0.5);
      });
  }
  doc.end();
};

// 🎨 ADVANCED CUSTOM TABLE RENDERER FOR PDF
const drawMonthlyAttendanceTable = (doc, data, monthStr) => {
    if (!data || data.length === 0) {
        doc.fontSize(12).text("No records found for this month.", { align: 'center' });
        return;
    }

    const [year, month] = monthStr.split("-");
    const daysInMonth = new Date(year, month, 0).getDate();

    const startX = 30;
    let startY = doc.y;
    const cellHeight = 25; 
    
    const nameWidth = 100;
    const dayWidth = 20; 
    const summaryWidth = 25; 
    
    // Header
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
    doc.text("Employee", startX, startY + 5, { width: nameWidth, align: "left" });
    
    let currentX = startX + nameWidth;
    for (let i = 1; i <= daysInMonth; i++) {
        const isWeekend = new Date(year, month - 1, i).getDay() === 0;
        doc.fillColor(isWeekend ? "#6366f1" : "#000000");
        doc.text(i.toString(), currentX, startY + 5, { width: dayWidth, align: "center" });
        currentX += dayWidth;
    }

    doc.fillColor("#16a34a").text("P", currentX, startY + 5, { width: summaryWidth, align: "center" });
    doc.fillColor("#ef4444").text("A", currentX + summaryWidth, startY + 5, { width: summaryWidth, align: "center" });
    doc.fillColor("#f59e0b").text("L", currentX + (summaryWidth*2), startY + 5, { width: summaryWidth, align: "center" });
    doc.fillColor("#8b5cf6").text("O", currentX + (summaryWidth*3), startY + 5, { width: summaryWidth, align: "center" });

    startY += cellHeight;
    doc.moveTo(startX, startY).lineTo(currentX + (summaryWidth*4), startY).strokeColor("#334155").lineWidth(1.5).stroke();
    
    // Rows
    doc.font("Helvetica").fontSize(8);
    data.forEach(emp => {
        if (startY > 500) { doc.addPage({layout: 'landscape', margin: 30}); startY = 30; }

        startY += 8; 
        doc.fillColor("#0f172a").text(emp.name, startX, startY, { width: nameWidth, align: "left", lineBreak: false });

        currentX = startX + nameWidth;
        for (let i = 1; i <= daysInMonth; i++) {
            const status = emp.attendance[i];
            let char = "-";
            let color = "#cbd5e1"; 

            if (status === "Present") { char = "P"; color = "#10b981"; }
            else if (status === "Absent") { char = "A"; color = "#ef4444"; }
            else if (status === "Late") { char = "L"; color = "#f59e0b"; }
            else if (status === "On Leave" || status === "Half Day") { char = "O"; color = "#8b5cf6"; }
            else if (status === "Weekly Off" || status === "Holiday") { char = "W"; color = "#94a3b8"; }

            const isWeekend = new Date(year, month - 1, i).getDay() === 0;
            if (isWeekend) {
               doc.rect(currentX, startY - 5, dayWidth, cellHeight).fillOpacity(0.05).fillAndStroke("#6366f1", "transparent");
               doc.fillOpacity(1); 
            }

            doc.fillColor(color).text(char, currentX, startY, { width: dayWidth, align: "center" });
            currentX += dayWidth;
        }

        doc.font("Helvetica-Bold");
        doc.fillColor("#10b981").text(emp.present.toString(), currentX, startY, { width: summaryWidth, align: "center" });
        doc.fillColor("#ef4444").text(emp.absent.toString(), currentX + summaryWidth, startY, { width: summaryWidth, align: "center" });
        doc.fillColor("#f59e0b").text(emp.late.toString(), currentX + (summaryWidth*2), startY, { width: summaryWidth, align: "center" });
        doc.fillColor("#8b5cf6").text(emp.leave.toString(), currentX + (summaryWidth*3), startY, { width: summaryWidth, align: "center" });
        doc.font("Helvetica"); 

        startY += cellHeight - 8;
        doc.moveTo(startX, startY).lineTo(currentX + (summaryWidth*4), startY).dash(2, {space: 2}).strokeColor("#e2e8f0").lineWidth(1).stroke().undash();
    });
};

const generateDynamicReport = async (req, res) => {
  try {
    const { type, month, employeeId, branchId, departmentId } = req.query; 
    
    const requestingUser = await User.findById(req.user.id);
    const companyId = requestingUser.role === 'admin' ? requestingUser._id : requestingUser.companyId;

    let data = [];

    if (type === "attendance") {
      let targetMonth = month || moment().format("YYYY-MM");
      const startOfMonth = moment(targetMonth, "YYYY-MM").startOf("month").toDate();
      const endOfMonth = moment(targetMonth, "YYYY-MM").endOf("month").toDate();

      let empQuery = { role: "employee", companyId: companyId };
      if (employeeId) empQuery._id = employeeId;
      if (branchId) empQuery.branchId = branchId;
      if (departmentId) empQuery.departmentId = departmentId;
      
      const employees = await User.find(empQuery);
      if(employees.length === 0) return streamReportDirectly(res, type, [], targetMonth);

      const validEmpIds = new Set(employees.map(e => String(e._id)));
      
      const attendanceRecords = await Attendance.find({
          companyId: companyId,
          date: { $gte: startOfMonth, $lte: endOfMonth }
      }).populate("employeeId");

      const empMap = {};
      
      employees.forEach(emp => {
          empMap[emp._id.toString()] = { 
              name: emp.name, attendance: {}, 
              present: 0, absent: 0, late: 0, leave: 0 
          };
      });

      // 🔥 FIX: BULLETPROOF DATE EXTRACTION
      attendanceRecords.forEach((record) => {
        const emp = record.employeeId;
        if (!emp || !emp._id) return;
        
        const empIdStr = String(emp._id);
        if (!validEmpIds.has(empIdStr) || !empMap[empIdStr]) return;
        
        let day = null;
        if (record.date) {
           const dateStr = String(record.date);
           if (dateStr.includes('T')) {
               day = parseInt(dateStr.split('T')[0].split('-')[2], 10); 
           } else {
               const d = new Date(dateStr);
               if (!isNaN(d.getDate())) day = d.getDate();
           }
        }

        if (!day || isNaN(day) || day < 1 || day > 31) return;

        const status = record.status || "Absent";
        empMap[empIdStr].attendance[day] = status;
        
        if (status === "Present") empMap[empIdStr].present++;
        else if (status === "Absent") empMap[empIdStr].absent++;
        else if (status === "Late") empMap[empIdStr].late++;
        else if (status === "On Leave" || status === "Half Day") empMap[empIdStr].leave++;
      });

      data = Object.values(empMap).sort((a,b) => a.name.localeCompare(b.name));
      return streamReportDirectly(res, type, data, targetMonth);
    } 
    // ... Handle other types (leaves, users, projects) same as old code ...
  } catch (err) {
    console.error(err);
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
    // Admin ke liye uska khud ka ID hi companyId hai (as per your logic)
    const companyId = req.user.role === "admin" ? req.user._id : req.user.companyId;

    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);

    const [
      employeeCount, leaveCount, attendanceCount,
      exitCount, todayAttendance, projectCount,
    ] = await Promise.all([
      User.countDocuments({ role: "employee", companyId }),
      Leave.countDocuments({ companyId }),
      Attendance.countDocuments({ companyId }),
      Exit.countDocuments({ companyId }),
      Attendance.countDocuments({
        companyId,
        date: { $gte: start, $lt: end },
      }),
      Project.countDocuments({ companyId }),
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
  } catch (error) {
    res.status(500).json({ success: false, message: "Analytics error" });
  }
};
module.exports = {
  generateDynamicReport,
  getReports,
  getDashboardAnalytics,
  streamReportDirectly,
};
