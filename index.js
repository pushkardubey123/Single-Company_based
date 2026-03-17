const express = require("express");
const dotenv = require("dotenv");
const dbConnect = require("./Dbconnect/dbConfig");
const fileupload = require("express-fileupload");
const cors = require("cors");
const path = require("path");

const timesheetRoutes = require("./Router/timesheetRoutes");
const holidayRoutes = require("./Router/Leave/holiday.routes");
const AuthorityRoutes = require("./Router/authorityRoutes");
const permissionRouter = require("./Router/permissionRoutes");
const assetRoutes = require("./Router/assetRoutes");

dotenv.config();
const app = express();

// ✅ FIXED CORS CONFIG
app.use(cors({
  origin: [
    "https://single-company-based-frontend.onrender.com", // 👈 frontend url
    "http://localhost:5173" // 👈 local testing
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));


// ✅ COOP FIX (Google Auth issue fix)
app.use((req, res, next) => {
  res.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.header("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

dbConnect();

require("./utils/taskDeadlineNotifier")();
require("./utils/birthdayAnniversaryNotifier")();
require("./utils/autoAbsent")();

app.use(express.json());

app.use(
  fileupload({
    useTempFiles: true,
    tempFileDir: path.join(__dirname, "tmp"),
  })
);

app.use("/static", express.static(path.join(__dirname, "uploads")));

// ROUTES (unchanged)
app.use("/api/departments", require("./Router/departmentRouter"));
app.use("/api/designations", require("./Router/designationRouter"));
app.use("/api/shifts", require("./Router/ShiftRouter"));
app.use("/api/projects", require("./Router/projectRoutes"));
app.use("/api/leaves", require("./Router/LeaveRouter"));
app.use("/api/attendance", require("./Router/AttendanceRouter"));
app.use("/api/payrolls", require("./Router/PayrollsRouter"));
app.use("/api/documents", require("./Router/documentRoutes"));
app.use("/api/exit", require("./Router/exitRoutes"));
app.use("/api/reports", require("./Router/reportRoutes"));
app.use("/api/notifications", require("./Router/notificationRoutes"));
app.use("/mail", require("./Router/mailRoutes"));
app.use("/api", require("./Router/workFromHomeRoutes"));
app.use(require("./Router/userRouter"));

app.use("/api/permission", AuthorityRoutes);
app.use("/api", permissionRouter);
app.use("/api/assets", assetRoutes);
app.use("/api/applications", require("./Router/applicationRoutes"));
app.use("/api/interviews", require("./Router/interviewRoutes"));
app.use("/api/timesheet", timesheetRoutes);
app.use("/api/events", require("./Router/eventRoutes"));
app.use("/api/meeting", require("./Router/meetingRoutes"));
app.use("/api/jobs", require("./Router/jobRoutes"));
app.use("/api", require("./Router/branchRoutes"));
app.use("/api/leads", require("./Router/leadRoutes"));
app.use("/api/settings", require("./Router/companySettings"));
app.use("/api/officetimming", require("./Router/officeTimingRoutes"));
app.use("/api/leave-types", require("./Router/Leave/LeaveTypeRouter"));
app.use("/api/leave-policies", require("./Router/Leave/leavePolicyRoutes"));
app.use("/api/holidays", holidayRoutes);

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Server is running on: ${PORT}`);
});