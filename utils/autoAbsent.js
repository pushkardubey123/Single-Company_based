const cron = require("node-cron");
const moment = require("moment-timezone");

const Attendance = require("../Modals/Attendence");
const User = require("../Modals/User");
const OfficeTiming = require("../Modals/OfficeTiming");

/* ===================== AUTO ABSENT JOB ===================== */
const autoAbsentJob = () => {
  // ⏰ Every day at 11:59 PM IST
  cron.schedule(
    "59 23 * * *",
    async () => {
      try {
        console.log("🔄 Auto Absent Job Started");

        const todayStart = moment
          .tz("Asia/Kolkata")
          .startOf("day")
          .toDate();

        const todayEnd = moment
          .tz("Asia/Kolkata")
          .endOf("day")
          .toDate();

        // 🔹 All office timings
        const timings = await OfficeTiming.find();

        for (const timing of timings) {
          const { companyId, branchId, officeEnd } = timing;

          if (!officeEnd) continue;

          // 🕕 officeEnd → moment
          const officeEndMoment = moment
            .tz(officeEnd, "HH:mm", "Asia/Kolkata");

          // ⏱️ current time
          const now = moment.tz("Asia/Kolkata");

          // ❌ Skip if office time not over
          if (now.isBefore(officeEndMoment)) continue;

          // 👨‍💼 All employees of this branch
          const employees = await User.find({
            companyId,
            branchId,
            role: "Employee",
            isActive: true,
          }).select("_id");

          for (const emp of employees) {
            const exists = await Attendance.findOne({
              employeeId: emp._id,
              date: { $gte: todayStart, $lte: todayEnd },
            });

            // ❌ Already marked → skip
            if (exists) continue;

            // ✅ AUTO ABSENT
            await Attendance.create({
              employeeId: emp._id,
              companyId,
              branchId,
              date: new Date(),
              status: "Absent",
              statusType: "Auto",
              inOutLogs: [],
            });
          }
        }

        console.log("✅ Auto Absent Job Completed");
      } catch (err) {
        console.error("❌ Auto Absent Error:", err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
};

module.exports = autoAbsentJob;
