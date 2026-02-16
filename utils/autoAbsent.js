const cron = require("node-cron");
const moment = require("moment-timezone");

const Attendance = require("../Modals/Attendence");
const User = require("../Modals/User");
const OfficeTiming = require("../Modals/OfficeTiming");
const Leave = require("../Modals/Leave");
const LeaveSettings = require("../Modals/Leave/LeaveSettings");
const Holiday = require("../Modals/Leave/Holiday");

/* ===================== AUTO ATTENDANCE JOB ===================== */
const autoAbsentJob = () => {
  // ⏰ Runs Every Day at 11:59 PM IST
  cron.schedule(
    "59 23 * * *",
    async () => {
      try {
        console.log("🔄 Auto Attendance Job Started...");

        const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
        const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();
        const currentDateStr = moment.tz("Asia/Kolkata").format("YYYY-MM-DD");
        const dayOfWeek = moment.tz("Asia/Kolkata").day(); // 0=Sun, 6=Sat

        // 1. Get Global Settings (For Weekends)
        // Assuming single company setup or loop for multiple companies. 
        // For simplicity, fetching generic settings (Adjust if multi-tenant)
        const settings = await LeaveSettings.findOne(); // Or find specific to company in loop
        const isSundayOff = settings?.isSundayOff !== false; // Default True
        const isSaturdayOff = settings?.isSaturdayOff === true;

        // 2. Check if Today is a Global Holiday
        const holiday = await Holiday.findOne({
            startDate: { $lte: todayEnd },
            endDate: { $gte: todayStart }
        });

        // 3. Get All Office Timings (To iterate per branch/company)
        const timings = await OfficeTiming.find();

        for (const timing of timings) {
          const { companyId, branchId, officeEnd } = timing;
          if (!officeEnd) continue;

          // Check if office time is actually over
          const officeEndMoment = moment.tz(officeEnd, "HH:mm", "Asia/Kolkata");
          const now = moment.tz("Asia/Kolkata");
          if (now.isBefore(officeEndMoment)) continue;

          // 4. Get Active Employees for this Branch
          const employees = await User.find({
            companyId,
            branchId,
            role: "employee", // Ensure case matches your DB
            status: "active",
          }).select("_id");

          for (const emp of employees) {
            // A. Check if Attendance Exists
            const exists = await Attendance.findOne({
              employeeId: emp._id,
              date: { $gte: todayStart, $lte: todayEnd },
            });

            if (exists) continue; // Already marked (Present/Late)

            // B. Determine Status Priority
            let status = "Absent";
            let remarks = "System Auto";

            // Priority 1: Approved Leave
            const onLeave = await Leave.findOne({
                employeeId: emp._id,
                status: "Approved",
                startDate: { $lte: todayEnd },
                endDate: { $gte: todayStart }
            });

            if (onLeave) {
                status = "On Leave";
                remarks = `Leave: ${onLeave.leaveType}`;
            } 
            // Priority 2: Holiday (If not on personal leave)
            else if (holiday) {
                status = "Holiday";
                remarks = holiday.name;
            }
            // Priority 3: Weekend
            else if ((dayOfWeek === 0 && isSundayOff) || (dayOfWeek === 6 && isSaturdayOff)) {
                status = "Weekly Off";
            }

            // C. Create Record
            await Attendance.create({
              employeeId: emp._id,
              companyId,
              branchId,
              date: new Date(),
              inTime: "00:00",
              outTime: "00:00",
              status: status,
              statusType: "Auto",
              inOutLogs: [],
              workedMinutes: 0,
              overtimeMinutes: 0,
              adminCheckoutTime: remarks // Storing reason/leave type here
            });

            console.log(`✅ Auto-Marked ${emp._id}: ${status}`);
          }
        }
        console.log("✅ Auto Attendance Job Completed");
      } catch (err) {
        console.error("❌ Auto Absent Job Error:", err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
};

module.exports = autoAbsentJob;