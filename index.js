const express = require("express");
const dotenv = require("dotenv");
const dbConnect = require("./Dbconnect/dbConfig");
const fileupload = require("express-fileupload");
const cors = require("cors");
const path = require("path");
const cron = require('node-cron');
const { processAutoScheduledPayrolls } = require('./Controllers/PayrollController');

const timesheetRoutes = require("./Router/timesheetRoutes");
const holidayRoutes = require("./Router/Leave/holiday.routes");
const AuthorityRoutes = require("./Router/authorityRoutes");
const permissionRouter = require("./Router/permissionRoutes");
const assetRoutes = require("./Router/assetRoutes");
const superAdminRoutes = require("./Router/superAdminRoutes");

dotenv.config();
const app = express();

// ✅ CORS CONFIG (FINAL FIX)
const allowedOrigins = [
  "https://hareetechhr.onrender.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://superadmin-k9k7.onrender.com"
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (mobile apps, postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// ✅ PREFLIGHT FIX (IMPORTANT)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use((req, res, next) => {
  res.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.header("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

dbConnect();

require("./utils/taskDeadlineNotifier")();
require("./utils/birthdayAnniversaryNotifier")();
require("./utils/autoAbsent")();
require("./utils/subscriptionNotifier")();
cron.schedule('1 0 * * *', async () => {
    console.log("⏳ Running Scheduled Auto-Payroll Check...");
    try {
        await processAutoScheduledPayrolls();
        console.log("✅ Scheduled Auto-Payroll Check Complete.");
    } catch (error) {
        console.error("❌ Scheduled Auto-Payroll Error:", error);
    }
});

app.use(express.json());

app.use(
  fileupload({
    useTempFiles: true,
    tempFileDir: path.join(__dirname, "tmp"),
  })
);

app.use("/static", express.static(path.join(__dirname, "uploads")));

// ROUTES (UNCHANGED)

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
app.use("/api/payment", require("./Router/paymentRoutes"));
app.use("/api/holidays", holidayRoutes);
app.use("/api/superadmin", superAdminRoutes);

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Server is running on: ${PORT}`);
});