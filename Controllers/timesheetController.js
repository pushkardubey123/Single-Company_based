const attendanceTbl = require("../Modals/Attendence");
const OfficeTiming = require("../Modals/OfficeTiming");
const mongoose = require("mongoose");
const moment = require("moment");

const calculateOfficeHoursDuration = (logIn, logOut, officeStart, officeEnd) => {
    if (!logIn || !logOut || !officeStart || !officeEnd) return 0;

    // Convert strings to moment objects for today
    const start = moment(logIn, "HH:mm:ss A");
    const end = moment(logOut, "HH:mm:ss A");
    const oStart = moment(officeStart, "HH:mm");
    const oEnd = moment(officeEnd, "HH:mm");

    // Intersecting time: Jo waqt office hours ke andar hai sirf wahi count hoga
    const actualStart = moment.max(start, oStart);
    const actualEnd = moment.min(end, oEnd);

    const diff = actualEnd.diff(actualStart, 'hours', true);
    return diff > 0 ? diff : 0;
};

const getTimesheetReport = async (req, res) => {
    try {
        const { startDate, endDate, employee } = req.query;
        const { companyId } = req;
        const filter = { companyId };

        if (req.user.role !== "admin" && req.user.branchId) {
            filter.branchId = req.user.branchId;
        }

        if (startDate && endDate) {
            filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        if (employee && employee !== "all") {
            filter.employeeId = employee;
        }

        const records = await attendanceTbl
            .find(filter)
            .populate("employeeId", "name email")
            .populate("branchId", "name");

        // Fetch all office timings once to avoid multiple DB calls in loop
        const allTimings = await OfficeTiming.find({ companyId });

        const result = records.map((record) => {
            let totalWorkedHours = 0;
            const branchTiming = allTimings.find(t => 
                t.branchId.toString() === record.branchId?._id.toString()
            );

            if (branchTiming) {
                for (const log of record.inOutLogs || []) {
                    if (log.inTime && log.outTime) {
                        totalWorkedHours += calculateOfficeHoursDuration(
                            log.inTime, 
                            log.outTime, 
                            branchTiming.officeStart, 
                            branchTiming.officeEnd
                        );
                    }
                }
            }

            return {
                _id: record._id,
                employee: record.employeeId,
                branch: record.branchId,
                date: record.date,
                hours: Number(totalWorkedHours.toFixed(2)),
                status: record.status,
                remark: record.status === "Late" ? "Late Arrival" : "",
            };
        });

        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

/* ================= SINGLE EMPLOYEE ================= */
const getEmployeeTimesheet = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    // 🔒 SECURITY
    if (req.user.role === "employee" && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const records = await attendanceTbl
      .find({
        employeeId: id,
        companyId, // ✅ IMPORTANT
      })
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: records,
    });
  } catch (err) {
    console.error("Employee timesheet error:", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = { getTimesheetReport, getEmployeeTimesheet };