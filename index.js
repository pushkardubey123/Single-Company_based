const express = require("express");
const dotenv = require("dotenv");
const dbConnect = require("./Dbconnect/dbConfig");
const fileupload = require("express-fileupload");
const cors = require("cors");
const path = require("path");
const timesheetRoutes = require("./Router/timesheetRoutes");
dotenv.config();
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",   
      /\.netlify\.app$/        
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

dbConnect();
app.use(express.json());

app.use(
  fileupload({
    useTempFiles: true,
    tempFileDir: path.join(__dirname, "tmp"),
  })
);

app.use("/static", express.static(path.join(__dirname, "uploads")));

app.use("/api/departments", require("./Router/departmentRouter"));
app.use("/api/designations", require("./Router/designationRouter"));
app.use("/api/shifts", require("./Router/ShiftRouter"));
app.use("/api/projects", require("./Router/projectRoutes"));
app.use("/api/leaves", require("./Router/LeaveRouter"));
app.use("/api/attendance", require("./Router/AttendenceRouter"));
app.use("/api/payrolls", require("./Router/PayrollsRouter"));
app.use("/api/documents", require("./Router/documentRoutes"));
app.use("/api/exit", require("./Router/exitRoutes"));
app.use("/api/reports", require("./Router/reportRoutes"));
app.use("/api/notifications", require("./Router/notificationRoutes"));
app.use("/mail", require("./Router/mailRoutes"));
app.use("/api", require("./Router/workFromHomeRoutes"));
app.use(require("./Router/userRouter"));
app.use("/api/applications", require("./Router/applicationRoutes"));
app.use("/api/interviews", require("./Router/interviewRoutes"));
app.use("/api/timesheet", timesheetRoutes);
app.use("/api/events", require("./Router/eventRoutes"));
app.use("/api/meeting", require("./Router/meetingRoutes"));
app.use("/api/jobs", require("./Router/jobRoutes"));
require("./utils/taskDeadlineNotifier")();
require("./utils/birthdayAnniversaryNotifier")();
app.use("/api", require("./Router/branchRoutes"));
app.use("/api/leads", require("./Router/leadRoutes"));
app.use("/api/settings", require("./Router/companySettings"));
app.use("/api/officetimming", require("./Router/officeTimingRoutes"));
require("./utils/autoAbsent")();

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Server is running on: ${PORT}`);
});
 