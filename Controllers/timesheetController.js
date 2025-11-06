const attendanceTbl = require("../Modals/Attendence");
const mongoose = require("mongoose");
const calculateDuration = (inTime, outTime) => {
  if (
    !inTime ||
    !outTime ||
    typeof inTime !== "string" ||
    typeof outTime !== "string"
  ) {
    return 0;
  }

  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);

  const start = new Date(0, 0, 0, inH, inM);
  const end = new Date(0, 0, 0, outH, outM);

  const diff = (end - start) / (1000 * 60 * 60);
  return diff > 0 ? diff : 0;
};

const getTimesheetReport = async (req, res) => {
  try {
    const { startDate, endDate, employee } = req.query;
    const filter = {};

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
      .populate("employeeId", "name email");

    const result = records.map((record) => {
      let totalHours = 0;

      for (const log of record.inOutLogs) {
        if (log.inTime && log.outTime) {
          totalHours += calculateDuration(log.inTime, log.outTime);
        }
      }

      return {
        _id: record._id,
        employee: record.employeeId,
        date: record.date,
        hours: parseFloat(totalHours.toFixed(2)),
        remark: record.status === "Late" ? "Late Arrival" : "",
      };
    });

    res.status(200).json({
      success: true,
      message: "Timesheet data calculated",
      data: result,
    });
  } catch (err) {
    console.error("Error generating timesheet:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getEmployeeTimesheet = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    const records = await attendanceTbl
      .find({ employeeId: id })
      .populate("employeeId", "name");

    res.json({
      success: true,
      data: records,
    });
  } catch (err) {
    console.error("Timesheet error:", err);
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
