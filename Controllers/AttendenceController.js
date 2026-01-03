const attendanceTbl = require("../Modals/Attendence");
const { getDistance } = require("geolib");
const moment = require("moment-timezone"); 
const verifyFacePython = require("../utils/faceVerify.py-api");
const userTbl = require("../Modals/User");
const Branch = require("../Modals/Branch");


const fs = require("fs");
const path = require("path");

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const PROFILE_DIR = path.join(UPLOADS_DIR, "profiles");

if (!fs.existsSync(PROFILE_DIR)) {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
}


// fallback office location (agar employee ka branch nahi mila to)
const officeLocation = {
  latitude: 22.88925,
  longitude: 86.99116,
};

const getBranchLocation = async (branchId) => {
  if (!branchId) return null;
  try {
    const branch = await Branch.findById(branchId);
    if (!branch) return null;
    return {
      latitude: branch.latitude,
      longitude: branch.longitude,
      radius: branch.radius || 100, // meter
    };
  } catch (err) {
    console.error("Error fetching branch:", err);
    return null;
  }
};

const isWithinBranchRange = (userLat, userLon, branchLat, branchLon, branchRadius) => {
  if (!userLat || !userLon || !branchLat || !branchLon) return false;
  const distance = getDistance(
    { latitude: Number(userLat), longitude: Number(userLon) },
    { latitude: Number(branchLat), longitude: Number(branchLon) }
  );
  return distance <= (branchRadius || 100);
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
    const { latitude, longitude, liveImage } = req.body;
const employeeId = req.user._id;

console.log("ATTENDANCE PAYLOAD", {
  employeeId,
  latitude,
  longitude,
  hasImage: !!liveImage
});
    if (
  !employeeId ||
  typeof latitude !== "number" ||
  typeof longitude !== "number" ||
  !liveImage
) {

      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const employee = await userTbl.findById(employeeId);

    if (!employee || !employee.profilePic) {
      return res.status(404).json({ success: false, message: "Employee image missing" });
    }

    const storedImagePath = path.join(__dirname, "..", "uploads", employee.profilePic);

    if (!fs.existsSync(storedImagePath)) {
      return res.status(404).json({
        success: false,
        message: "Stored profile image not found on server"
      });
    }

    const faceResult = await verifyFacePython(storedImagePath, liveImage);

    if (!faceResult?.success) {
      return res.status(401).json({
        success: false,
        message: "Face not matched! Attendance denied",
      });
    }

    let branchInfo = null;
    if (employee.branchId) {
      branchInfo = await getBranchLocation(employee.branchId);
    }

    let allowedLat = officeLocation.latitude;
    let allowedLon = officeLocation.longitude;
    let allowedRadius = 200; 

    if (branchInfo) {
      allowedLat = branchInfo.latitude;
      allowedLon = branchInfo.longitude;
      allowedRadius = branchInfo.radius || allowedRadius;
    }

    const inside = isWithinBranchRange(latitude, longitude, allowedLat, allowedLon, allowedRadius);
    if (!inside) {
      return res.status(403).json({ success: false, message: "You are outside your branch location" });
    }
    // --- END NEW ---

    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();

    const alreadyMarked = await attendanceTbl.findOne({
      employeeId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    if (alreadyMarked) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked",
      });
    }

    const inTime = getCurrentTime();
    const hour = parseInt(moment.tz("Asia/Kolkata").format("HH"));
    const status = hour > 10 ? "Late" : "Present";

const attendance = new attendanceTbl({
  employeeId: employee._id,
  companyId: employee.companyId,   // ✅ AUTO
  branchId: employee.branchId,     // ✅ AUTO
  date: getISTDate(),
  inTime,
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
    console.error("Mark attendance error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const markSession = async (req, res) => {
  try {
    // 🔧 FIX 1: force number conversion
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    const { actionType } = req.body;

    // 🔧 FIX 2: same pattern as markAttendance
    const employeeId = req.user._id;

    // 🔧 FIX 3: proper validation
    if (
      !employeeId ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      !["in", "out"].includes(actionType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing fields",
      });
    }

    const employee = await userTbl.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // ================= LOCATION CHECK =================
    let branchInfo = null;
    if (employee.branchId) {
      branchInfo = await getBranchLocation(employee.branchId);
    }

    let allowedLat = officeLocation.latitude;
    let allowedLon = officeLocation.longitude;
    let allowedRadius = 200;

    if (branchInfo) {
      allowedLat = branchInfo.latitude;
      allowedLon = branchInfo.longitude;
      allowedRadius = branchInfo.radius || allowedRadius;
    }

    const inside = isWithinBranchRange(
      latitude,
      longitude,
      allowedLat,
      allowedLon,
      allowedRadius
    );

    if (!inside) {
      return res.status(403).json({
        success: false,
        message: "You are outside the allowed branch location",
      });
    }

    // ================= ATTENDANCE SESSION =================
    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();
    const currentTime = getCurrentTime();

    let attendance = await attendanceTbl.findOne({
      employeeId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    // 🔹 First IN
    if (!attendance && actionType === "in") {
      attendance = new attendanceTbl({
        employeeId: employee._id,
        companyId: employee.companyId,
        branchId: employee.branchId,
        date: getISTDate(),
        inTime: currentTime,
        location: { latitude, longitude },
        status: "Present",
        statusType: "Auto",
        inOutLogs: [{ inTime: currentTime, outTime: null }],
      });
    }

    // 🔹 Existing attendance
    else if (attendance) {
      const last = attendance.inOutLogs[attendance.inOutLogs.length - 1];

      if (actionType === "in") {
        if (!last || last.outTime) {
          attendance.inOutLogs.push({
            inTime: currentTime,
            outTime: null,
          });
        } else {
          return res.status(400).json({
            success: false,
            message: "Already checked in",
          });
        }
      }

      if (actionType === "out") {
        if (last && !last.outTime) {
          last.outTime = currentTime;
        } else {
          return res.status(400).json({
            success: false,
            message: "Already checked out or no session started",
          });
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "No attendance record for today",
      });
    }

    const saved = await attendance.save();

    res.status(200).json({
      success: true,
      message: "Session updated",
      data: saved,
    });
  } catch (err) {
    console.error("MARK SESSION ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
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
      .find({ companyId: req.companyId })   // ✅ IMPORTANT
      .populate("employeeId", "name email")
      .populate("branchId", "name latitude longitude radius")
      .sort({ date: -1 });

    const grouped = {};
    all.forEach((record) => {
      const dateKey = new Date(record.date).toDateString();
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(record);
    });

    res.status(200).json({
      success: true,
      data: grouped,
    });
  } catch (err) {
    console.error("GET ATTENDANCE ERROR:", err);
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
       const emp = await userTbl.findById(empId).select("companyId branchId");

const newAtt = new attendanceTbl({
  employeeId: empId,
  companyId: emp.companyId,
  branchId: emp.branchId,
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
