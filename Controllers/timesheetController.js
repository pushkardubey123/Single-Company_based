const attendanceTbl = require("../Modals/Attendence");
const mongoose = require("mongoose");

/* ================= UTILS ================= */
const calculateDuration = (inTime, outTime) => {
  if (!inTime || !outTime) return 0;

  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);

  const start = new Date(0, 0, 0, inH, inM);
  const end = new Date(0, 0, 0, outH, outM);

  const diff = (end - start) / (1000 * 60 * 60);
  return diff > 0 ? diff : 0;
};

/* ================= ADMIN REPORT ================= */
const getTimesheetReport = async (req, res) => {
  try {
    const { startDate, endDate, employee } = req.query;
    const { companyId } = req;
    const filter = {
      companyId, // ✅ IMPORTANT
    };

    // branch scoped (admin ke branch se)
    if (req.user.role !== "admin" && req.user.branchId) {
      filter.branchId = req.user.branchId;
    }

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (employee && employee !== "all") {
      filter.employeeId = employee;
    }

    const records = await attendanceTbl
      .find(filter)
      .populate("employeeId", "name email")
      .populate("branchId", "name");

    const result = records.map((record) => {
      let totalHours = 0;

      for (const log of record.inOutLogs || []) {
        if (log.inTime && log.outTime) {
          totalHours += calculateDuration(log.inTime, log.outTime);
        }
      }

      return {
        _id: record._id,
        employee: record.employeeId,
        branch: record.branchId,
        date: record.date,
        hours: Number(totalHours.toFixed(2)),
        status: record.status,
        remark: record.status === "Late" ? "Late Arrival" : "",
      };
    });

    res.status(200).json({
      success: true,
      message: "Timesheet report fetched",
      data: result,
    });
  } catch (err) {
    console.error("Timesheet report error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
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

module.exports = {
  getTimesheetReport,
  getEmployeeTimesheet,
};
