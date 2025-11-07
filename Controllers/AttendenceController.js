const attendanceTbl = require("../Modals/Attendence");
const { getDistance } = require("geolib");
const moment = require("moment-timezone"); 

const officeLocation = {
  latitude: 26.88925,
  longitude: 80.99116,
};

const getISTDate = () => {
  return moment.tz(new Date(), "Asia/Kolkata").toDate();
};

const getCurrentTime = () => {
  return moment.tz("Asia/Kolkata").format("hh:mm:ss A");
};

const isWithinOfficeRange = (lat, lon) => {
  if (!lat || !lon) return false;
  const distance = getDistance({ latitude: lat, longitude: lon }, officeLocation);
  return distance <= 200;
};

const markAttendance = async (req, res) => {
  try {
    const { employeeId, latitude, longitude } = req.body;
    if (!employeeId || !latitude || !longitude) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (!isWithinOfficeRange(latitude, longitude)) {
      return res.status(403).json({
        success: false,
        message: "You are outside the allowed office location",
      });
    }

    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();

    const alreadyMarked = await attendanceTbl.findOne({
      employeeId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    if (alreadyMarked) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked for today",
      });
    }

    // ✅ Store inTime as IST string
    const inTime = moment.tz("Asia/Kolkata").format("HH:mm:ss");
    const hour = parseInt(moment.tz("Asia/Kolkata").format("HH"));
    const status = hour > 10 ? "Late" : "Present";

    const attendance = new attendanceTbl({
      employeeId,
      date: todayStart,       // keep Date object for queries
      inTime,                 // IST string
      location: { latitude, longitude },
      status,
      statusType: "Auto",
      inOutLogs: [{ inTime, outTime: null }],
    });

    const result = await attendance.save();
    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const markSession = async (req, res) => {
  try {
    const { employeeId, latitude, longitude, actionType } = req.body;

    if (!employeeId || !latitude || !longitude || !actionType) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    if (!isWithinOfficeRange(latitude, longitude)) {
      return res.status(403).json({
        success: false,
        message: "You are outside the allowed office location",
      });
    }

    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();

    // ✅ IST string for current time
    const currentTime = moment.tz("Asia/Kolkata").format("HH:mm:ss");

    let attendance = await attendanceTbl.findOne({
      employeeId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    if (!attendance && actionType === "in") {
      attendance = new attendanceTbl({
        employeeId,
        date: todayStart,
        inTime: currentTime,
        location: { latitude, longitude },
        status: "Present",
        statusType: "Auto",
        inOutLogs: [{ inTime: currentTime, outTime: null }],
      });
    } else if (attendance) {
      const last = attendance.inOutLogs[attendance.inOutLogs.length - 1];
      if (actionType === "in") {
        if (!last || last.outTime) {
          attendance.inOutLogs.push({ inTime: currentTime, outTime: null });
        } else {
          return res.status(400).json({ success: false, message: "Already checked in" });
        }
      } else if (actionType === "out") {
        if (last && !last.outTime) {
          last.outTime = currentTime; // store IST string
        } else {
          return res.status(400).json({
            success: false,
            message: "Already checked out or no session started",
          });
        }
      }
    } else {
      return res.status(400).json({ success: false, message: "No attendance record for today" });
    }

    const saved = await attendance.save();
    res.status(200).json({ success: true, message: "Session updated", data: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getMonthlyAttendance = async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ success: false, message: "Month is required" });
    }

    const startOfMonth = moment.tz(month, "YYYY-MM", "Asia/Kolkata").startOf("month").toDate();
    const endOfMonth = moment.tz(month, "YYYY-MM", "Asia/Kolkata").endOf("month").toDate();

    const attendanceRecords = await attendanceTbl
      .find({ date: { $gte: startOfMonth, $lte: endOfMonth } })
      .populate("employeeId", "name email");

    res.status(200).json({ success: true, data: attendanceRecords });
  } catch (error) {
    console.error("Error fetching monthly attendance:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getAllAttendance = async (req, res) => {
  try {
    const all = await attendanceTbl
      .find()
      .populate("employeeId", "name email")
      .sort({ date: -1 });

    const grouped = {};

    all.forEach((record) => {
      const dateKey = new Date(record.date).toDateString();
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(record);
    });

    res.status(200).json({ success: true, message: "Grouped attendance fetched", data: grouped });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getAttendanceByEmployee = async (req, res) => {
  try {
    const employeeId = req.params.id;
    const data = await attendanceTbl.find({ employeeId }).sort({ date: -1 });

    res.status(200).json({ success: true, message: "Attendance fetched", code: 200, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal Server Error", code: 500 });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const { status, statusType } = req.body;

    const updated = await attendanceTbl.findByIdAndUpdate(
      req.params.id,
      { status, statusType: statusType || "Manual" },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Attendance not found" });
    }

    res.status(200).json({ success: true, message: "Attendance updated", code: 200, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal Server Error", code: 500 });
  }
};

const deleteAttendance = async (req, res) => {
  try {
    const deleted = await attendanceTbl.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Attendance not found" });
    }
    res.status(200).json({ success: true, message: "Attendance deleted", code: 200 });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal Server Error", code: 500 });
  }
};

const bulkMarkAttendance = async (req, res) => {
  try {
    const { employeeIds, date } = req.body;
    if (!employeeIds || !date) {
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    const newAttendances = [];

    for (const empId of employeeIds) {
      const exists = await attendanceTbl.findOne({
        employeeId: empId,
        date: {
          $gte: new Date(date),
          $lt: new Date(new Date(date).getTime() + 86400000),
        },
      });

      if (!exists) {
        const newAtt = new attendanceTbl({
          employeeId: empId,
          date,
          inTime: "09:00",
          status: "Present",
          statusType: "Manual",
          inOutLogs: [{ inTime: "09:00", outTime: null }],
        });
        await newAtt.save();
        newAttendances.push(newAtt);
      }
    }

    res.status(200).json({
      success: true,
      message: `Success: ${newAttendances.length} attendance records added.`,
      data: newAttendances,
    });
  } catch (err) {
    console.error("Bulk mark error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  markAttendance,
  markSession,
  getAllAttendance,
  getAttendanceByEmployee,
  updateAttendance,
  deleteAttendance,
  bulkMarkAttendance,
  getMonthlyAttendance,
};
