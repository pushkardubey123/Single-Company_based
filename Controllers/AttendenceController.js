const attendanceTbl = require("../Modals/Attendence");
const { getDistance } = require("geolib");
const moment = require("moment-timezone"); 
const verifyFacePython = require("../utils/faceVerify.py-api");
const userTbl = require("../Modals/User");
const Branch = require("../Modals/Branch");
const Shift = require("../Modals/Shift");
const CompanySettings = require("../Modals/CompanySettings");
const OfficeTiming = require("../Modals/OfficeTiming");
const fs = require("fs");
const path = require("path");

const Leave = require("../Modals/Leave");
const Holiday = require("../Modals/Leave/Holiday");
const LeaveSettings = require("../Modals/Leave/LeaveSettings");

const syncPastAttendance = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const companyId = req.companyId;

    // 1. Employees Fetch
    let filter = { companyId, role: "employee", status: "active" };
    if (employeeId) filter._id = employeeId;
    const employees = await userTbl.find(filter);

    // 2. Settings & Holidays
    let settings = await LeaveSettings.findOne({ companyId });
    if (!settings) settings = { isSaturdayOff: true, isSundayOff: true };
    const holidays = await Holiday.find({ companyId });

    let updatedCount = 0;

    for (const emp of employees) {
      if (!emp.doj) continue;

      const start = moment(emp.doj).tz("Asia/Kolkata").startOf("day");
      const end = moment().tz("Asia/Kolkata").subtract(1, 'days').endOf("day");

      let loopDate = start.clone();

      while (loopDate.isSameOrBefore(end)) {
        const todayStart = loopDate.clone().startOf('day').toDate();
        const todayEnd = loopDate.clone().endOf('day').toDate();
        const dateStr = loopDate.format("YYYY-MM-DD");
        const dayOfWeek = loopDate.day();

        // 🔥 STEP A: Find Existing Record (Duplicate Rokne ke liye)
        let attendance = await attendanceTbl.findOne({
          employeeId: emp._id,
          date: { $gte: todayStart, $lte: todayEnd }
        });

        // Determine What the Status SHOULD Be
        let targetStatus = "Absent";
        let remarks = "System Auto";

        // 1. Check Weekend
        if ((dayOfWeek === 0 && settings.isSundayOff) || (dayOfWeek === 6 && settings.isSaturdayOff)) {
          targetStatus = "Weekly Off";
        }

        // 2. Check Holiday
        const isHoliday = holidays.some(h => {
             const hStart = moment(h.startDate).format("YYYY-MM-DD");
             const hEnd = moment(h.endDate).format("YYYY-MM-DD");
             return dateStr >= hStart && dateStr <= hEnd;
        });
        if (isHoliday) {
            targetStatus = "Holiday";
            remarks = "Holiday";
        }

        // 3. 🔥 Check Approved Leave (Sabse Important)
        if (targetStatus === "Absent") {
            const leave = await Leave.findOne({
              employeeId: emp._id,
              status: "Approved",
              // Leave Range Logic:
              startDate: { $lte: todayEnd }, 
              endDate: { $gte: todayStart }
            });
            
            if (leave) {
              targetStatus = "On Leave";
              remarks = leave.leaveType;
            }
        }

        // 🔥 STEP B: Action based on Existence
        if (!attendance) {
            // Case 1: Record hi nahi hai -> Create New
            await attendanceTbl.create({
                employeeId: emp._id,
                companyId,
                branchId: emp.branchId,
                date: loopDate.toDate(), // Store standard Date object
                inTime: "00:00",
                outTime: "00:00",
                status: targetStatus,
                statusType: "Auto",
                inOutLogs: [],
                workedMinutes: 0,
                overtimeMinutes: 0,
                adminCheckoutTime: remarks
            });
            updatedCount++;
        } 
        else {
            // Case 2: Record hai, lekin "Absent" hai aur ab "On Leave" mil gaya
            // (Ye aapki 10th Feb wali problem solve karega)
            if (attendance.status === "Absent" && targetStatus === "On Leave") {
                attendance.status = "On Leave";
                attendance.adminCheckoutTime = remarks; // e.g. "Sick Leave"
                await attendance.save();
                console.log(`✅ Corrected Absent to Leave for ${dateStr}`);
                updatedCount++;
            }
            // Case 3: Agar duplicate hatana ho (Optional Cleanup Logic handled separately)
        }

        loopDate.add(1, 'days');
      }
    }

    res.json({ success: true, message: `Sync Processed. Updated/Created ${updatedCount} records.` });

  } catch (err) {
    console.error("Sync Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
// ... existing imports

const removeDuplicates = async (req, res) => {
  try {
    console.log("🛠️ Controller: Starting Remove Duplicates...");
    console.log("🏢 Controller: Received Company ID:", req.companyId);

    // 1. Validation
    if (!req.companyId) {
        throw new Error("STOP: Company ID is undefined in Controller!");
    }

    // 2. Fetch Records
    // Sirf wahi records lao jahan employeeId exist karta ho (Filter in DB directly)
    const allRecords = await attendanceTbl.find({ 
        companyId: req.companyId,
        employeeId: { $ne: null } // MongoDB level filter to avoid nulls
    }).sort({ createdAt: -1 });

    console.log(`📊 Processing ${allRecords.length} valid records...`);

    const seen = new Set();
    const duplicateIds = [];

    for (const record of allRecords) {
      try {
          // Extra Safety: DB filter ke baad bhi check kar lo
          if (!record.employeeId || !record.date) continue;

          // Safe Conversion
          // Agar employeeId object hai to string banao, agar string hai to waise hi use karo
          const empIdStr = record.employeeId.toString(); 
          const dateStr = moment(record.date).format("YYYY-MM-DD");

          const key = `${empIdStr}-${dateStr}`;

          if (seen.has(key)) {
            duplicateIds.push(record._id);
          } else {
            seen.add(key);
          }
      } catch (innerErr) {
          console.error("⚠️ Skipping bad record:", innerErr.message);
          continue;
      }
    }

    // 3. Delete
    if (duplicateIds.length > 0) {
      await attendanceTbl.deleteMany({ _id: { $in: duplicateIds } });
      console.log(`🗑️ Deleted ${duplicateIds.length} duplicates.`);
    }

    res.json({ success: true, message: `Cleanup done. Removed ${duplicateIds.length} duplicates.` });

  } catch (err) {
    console.error("❌ CRITICAL ERROR (removeDuplicates):", err);
    // 500 bhejne se pehle error ka reason client ko batao
    res.status(500).json({ success: false, message: err.message });
  }
};

// ... existing exports


/* ================== FILE SYSTEM SETUP ================== */
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const PROFILE_DIR = path.join(UPLOADS_DIR, "profiles");
if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

/* ================== UTILITY FUNCTIONS ================== */
const officeLocation = { latitude: 22.88925, longitude: 86.99116 };

const getBranchLocation = async (branchId) => {
  if (!branchId) return null;
  try {
    const branch = await Branch.findById(branchId);
    return branch ? { latitude: branch.latitude, longitude: branch.longitude, radius: branch.radius || 100 } : null;
  } catch (err) { console.error(err); return null; }
};

const isWithinBranchRange = (uLat, uLon, bLat, bLon, radius) => {
  if (!uLat || !uLon || !bLat || !bLon) return false;
  return getDistance(
    { latitude: Number(uLat), longitude: Number(uLon) },
    { latitude: Number(bLat), longitude: Number(bLon) }
  ) <= (radius || 100);
};

const getISTDate = () => moment.tz(new Date(), "Asia/Kolkata").toDate();
const getCurrentTime = () => moment.tz("Asia/Kolkata").format("hh:mm:ss A");

// ✅ FIX: Robust Time Comparison Logic (Handles 10:00 AM vs 05:00 PM correctly)
const isShiftOver = (currentTime, shiftEndTime) => {
    // Convert both to moment objects on the same dummy date to compare time only
    const now = moment(currentTime, "hh:mm:ss A");
    const end = moment(shiftEndTime, ["HH:mm", "hh:mm A", "h:mm A"]);
    
    // Check if current time is after end time
    return now.isAfter(end);
};

// --- PRIORITY WINDOW LOGIC (Shift > Branch > Default) ---
const getEffectiveWindow = async (employee) => {
    if (employee.shiftId) {
        const shift = await Shift.findById(employee.shiftId);
        if (shift) return { start: shift.startTime, end: shift.endTime };
    }
    if (employee.branchId) {
        const timing = await OfficeTiming.findOne({ branchId: employee.branchId });
        if (timing) return { start: timing.officeStart, end: timing.officeEnd };
    }
    return { start: "09:00", end: "18:00" };
};

// --- METRICS CALCULATION (FIXED LOGIC) ---
// --- METRICS CALCULATION (ROBUST FIX) ---
const calculateMetrics = (logs, windowStart, windowEnd) => {
    let workedMinutes = 0;
    let overtimeMinutes = 0;
    
    // 1. Aaj ki date base bana lo (taaki time comparison accurate ho)
    const baseDate = moment().format("YYYY-MM-DD");

    // 2. Shift End Time ko aaj ki date ke saath moment object banao
    // Support multiple formats: "18:00", "06:00 PM", "6:00 PM"
    const shiftEndMoment = moment(`${baseDate} ${windowEnd}`, ["YYYY-MM-DD HH:mm", "YYYY-MM-DD hh:mm A"]);

    logs.forEach(log => {
        if (log.inTime && log.outTime) {
            // Logs ke time ko bhi aaj ki date ke saath parse karo
            const inTimeMoment = moment(`${baseDate} ${log.inTime}`, "YYYY-MM-DD hh:mm:ss A");
            const outTimeMoment = moment(`${baseDate} ${log.outTime}`, "YYYY-MM-DD hh:mm:ss A");
            
            // A. Calculate Total Duration
            const sessionDuration = outTimeMoment.diff(inTimeMoment, 'minutes');
            workedMinutes += sessionDuration > 0 ? sessionDuration : 0;

            // B. Calculate Overtime
            // Agar Checkout Time > Shift End Time hai
            if (outTimeMoment.isAfter(shiftEndMoment)) {
                
                // Effective Start for OT:
                // Case 1: Agar banda Shift End ke baad aaya (Late OT), to InTime se count karo.
                // Case 2: Agar banda Shift End se pehle aaya tha (Regular Shift), to ShiftEnd se count karo.
                let effectiveStart;
                
                if (inTimeMoment.isAfter(shiftEndMoment)) {
                    effectiveStart = inTimeMoment;
                } else {
                    effectiveStart = shiftEndMoment;
                }

                const otDuration = outTimeMoment.diff(effectiveStart, 'minutes');
                overtimeMinutes += otDuration > 0 ? otDuration : 0;
            }
        }
    });
    
    return { workedMinutes, overtimeMinutes };
};

/* ================== CONTROLLERS ================== */

// 1. MARK ATTENDANCE (FIRST CHECK-IN)
const markAttendance = async (req, res) => {
  try {
    const { latitude, longitude, liveImage } = req.body;
    const employeeId = req.user._id;

    if (!employeeId || typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({ success: false, message: "Missing location fields" });
    }

    const employee = await userTbl.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    // --- CHECK SHIFT STATUS ---
    const window = await getEffectiveWindow(employee);
    const currentTime = getCurrentTime();
    
    if (isShiftOver(currentTime, window.end)) {
        return res.status(403).json({ success: false, message: "Shift is over. Cannot mark attendance now." });
    }

    // --- FACE VERIFICATION ---
    const settings = await CompanySettings.findOne({ companyId: employee.companyId });
    const isFaceRequired = settings?.attendance?.faceRequired || false;

    if (isFaceRequired) {
      if (!liveImage) return res.status(400).json({ success: false, message: "Face scan required" });
      if (!employee.profilePic) return res.status(404).json({ success: false, message: "Profile photo missing" });
      
      const storedPath = path.join(__dirname, "..", "uploads", employee.profilePic);
      if (!fs.existsSync(storedPath)) return res.status(404).json({ success: false, message: "Reference photo missing" });

      const faceResult = await verifyFacePython(storedPath, liveImage);
      if (!faceResult?.success) return res.status(401).json({ success: false, message: "Face not matched" });
    }

    // --- LOCATION CHECK ---
    let branchInfo = await getBranchLocation(employee.branchId);
    let allowedLat = branchInfo ? branchInfo.latitude : officeLocation.latitude;
    let allowedLon = branchInfo ? branchInfo.longitude : officeLocation.longitude;
    let radius = branchInfo ? branchInfo.radius : 200;

    if (!isWithinBranchRange(latitude, longitude, allowedLat, allowedLon, radius)) {
      return res.status(403).json({ success: false, message: "Outside allowed location" });
    }

    // --- DUPLICATE CHECK ---
    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();
    const existing = await attendanceTbl.findOne({ employeeId, date: { $gte: todayStart, $lte: todayEnd } });
    if (existing) return res.status(400).json({ success: false, message: "Already marked today" });

    // --- LATE STATUS LOGIC ---
    const shiftStart = moment(window.start, ["HH:mm", "hh:mm A"]);
    const currentMoment = moment.tz("Asia/Kolkata");
    const status = currentMoment.isAfter(shiftStart.add(15, 'minutes')) ? "Late" : "Present";

    const attendance = new attendanceTbl({
      employeeId,
      companyId: employee.companyId,
      branchId: employee.branchId,
      date: getISTDate(),
      inTime: currentTime,
      location: { latitude, longitude },
      status, 
      statusType: "Auto",
      inOutLogs: [{ inTime: currentTime, outTime: null }]
    });

    await attendance.save();
    res.status(201).json({ success: true, message: `Marked (${isFaceRequired ? "Face" : "Loc"})`, data: attendance });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 2. MARK SESSION (CHECK-IN / CHECK-OUT)
const markSession = async (req, res) => {
  try {
    const { latitude, longitude, actionType } = req.body;
    const employeeId = req.user._id;

    if (!employeeId || !["in", "out"].includes(actionType)) return res.status(400).json({ success: false, message: "Invalid data" });

    const employee = await userTbl.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, message: "User not found" });

    // --- SHIFT CHECK (Only for Check-In) ---
    const window = await getEffectiveWindow(employee);
    const currentTime = getCurrentTime();

    if (actionType === "in") {
        if (isShiftOver(currentTime, window.end)) {
            return res.status(403).json({ success: false, message: "Shift is over. Cannot start new session." });
        }
    }

    // --- LOCATION CHECK ---
    let branchInfo = await getBranchLocation(employee.branchId);
    let allowedLat = branchInfo ? branchInfo.latitude : officeLocation.latitude;
    let allowedLon = branchInfo ? branchInfo.longitude : officeLocation.longitude;
    let radius = branchInfo ? branchInfo.radius : 200;

    if (!isWithinBranchRange(latitude, longitude, allowedLat, allowedLon, radius)) {
      return res.status(403).json({ success: false, message: "Outside allowed location" });
    }

    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();
    let attendance = await attendanceTbl.findOne({ employeeId, date: { $gte: todayStart, $lte: todayEnd } });

    if (!attendance) return res.status(400).json({ success: false, message: "Please mark attendance first" });

    const lastLog = attendance.inOutLogs[attendance.inOutLogs.length - 1];

    // --- CHECK IN ---
    if (actionType === "in") {
        if (!lastLog || lastLog.outTime) {
            attendance.inOutLogs.push({ inTime: currentTime, outTime: null });
        } else {
            return res.status(400).json({ success: false, message: "Already checked in" });
        }
    } 
    
    // --- CHECK OUT ---
    if (actionType === "out") {
        if (lastLog && !lastLog.outTime) {
            lastLog.outTime = currentTime;
            
            // Calculate Metrics
            const metrics = calculateMetrics(attendance.inOutLogs, window.start, window.end);
            
            attendance.workedMinutes = metrics.workedMinutes;
            attendance.overtimeMinutes = metrics.overtimeMinutes;

            // AUTO-APPROVE LOGIC (If no OT, approve immediately)
            if (metrics.overtimeMinutes <= 0) {
                attendance.overtimeApproved = true; 
            } else {
                attendance.overtimeApproved = false; 
            }
        } else {
            return res.status(400).json({ success: false, message: "Already checked out" });
        }
    }

    await attendance.save();
    res.status(200).json({ success: true, message: `Checked ${actionType} successfully`, data: attendance });

  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 3. UPDATE ATTENDANCE (MANUAL STATUS)
const updateAttendance = async (req, res) => {
  try {
    const { status, statusType } = req.body;
    let updateData = { status, statusType: statusType || "Manual" };

    // FIX: If Absent, clear everything
    if (status === "Absent") {
      updateData.workedMinutes = 0;
      updateData.overtimeMinutes = 0;
      updateData.inOutLogs = []; 
      updateData.overtimeApproved = false;
    }

    const updated = await attendanceTbl.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Not found" });
    
    res.status(200).json({ success: true, message: "Updated", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 4. ADMIN APPROVE ACTION
const adminApproveAction = async (req, res) => {
  try {
    const { attendanceId, action, manualOutTime, approveOT } = req.body;
    const attendance = await attendanceTbl.findById(attendanceId).populate('employeeId');
    if (!attendance) return res.status(404).json({ message: "Record not found" });

    // A. FIX MISSING CHECKOUT
    if (action === "MANUAL_CHECKOUT") {
      const lastLog = attendance.inOutLogs[attendance.inOutLogs.length - 1];
      if (!lastLog.outTime) {
        const window = await getEffectiveWindow(attendance.employeeId);
        
        if (manualOutTime) {
            lastLog.outTime = manualOutTime; 
        } else {
            // Auto Shift End Time
            // Parse shift end time safely
            const endM = moment(window.end, ["HH:mm", "hh:mm A"]);
            lastLog.outTime = endM.format("hh:mm:ss A");
        }
        attendance.statusType = "Manual";
      }
    }

    // B. APPROVE / REJECT OVERTIME
    if (action === "APPROVE_OT") {
      attendance.overtimeApproved = approveOT;
    }

    // C. RECALCULATE
    const window = await getEffectiveWindow(attendance.employeeId);
    const metrics = calculateMetrics(attendance.inOutLogs, window.start, window.end);
    
    attendance.workedMinutes = metrics.workedMinutes;
    attendance.overtimeMinutes = metrics.overtimeMinutes;

    if (attendance.overtimeMinutes <= 0) attendance.overtimeApproved = true;

    await attendance.save();
    res.json({ success: true, message: "Action Completed", data: attendance });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

// --- READ OPERATIONS (UNCHANGED) ---
const getMonthlyAttendance = async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ success: false, message: "Month required" });

    const startOfMonth = moment.tz(month, "YYYY-MM", "Asia/Kolkata").startOf("month").toDate();
    const endOfMonth = moment.tz(month, "YYYY-MM", "Asia/Kolkata").endOf("month").toDate();

    const records = await attendanceTbl.find({ date: { $gte: startOfMonth, $lte: endOfMonth } }).populate("employeeId", "name email");
    res.status(200).json({ success: true, data: records });
  } catch (err) { res.status(500).json({ success: false, message: "Server Error" }); }
};

const getAllAttendance = async (req, res) => {
  try {
    const all = await attendanceTbl
      .find({ companyId: req.companyId })
      .populate("employeeId", "name email")
      .populate("branchId", "name")
      .sort({ date: -1 });

    const grouped = {};
    all.forEach((record) => {
      const dateKey = new Date(record.date).toDateString();
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(record);
    });

    res.status(200).json({ success: true, data: grouped });
  } catch (err) { res.status(500).json({ success: false, message: "Server Error" }); }
};

const getAttendanceByEmployee = async (req, res) => {
  try {
    const data = await attendanceTbl.find({ employeeId: req.params.id }).sort({ date: -1 });
    res.status(200).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: "Server Error" }); }
};

const deleteAttendance = async (req, res) => {
  try {
    const deleted = await attendanceTbl.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Not found" });
    res.status(200).json({ success: true, message: "Deleted" });
  } catch (err) { res.status(500).json({ success: false, message: "Server Error" }); }
};

const bulkMarkAttendance = async (req, res) => {
  try {
    const { employeeIds, date } = req.body;
    if (!employeeIds || !date) return res.status(400).json({ success: false, message: "Missing fields" });

    const newAttendances = [];
    for (const empId of employeeIds) {
      const exists = await attendanceTbl.findOne({
        employeeId: empId,
        date: { $gte: new Date(date), $lt: new Date(new Date(date).getTime() + 86400000) },
      });

      if (!exists) {
        const emp = await userTbl.findById(empId).populate('shiftId');
        const window = await getEffectiveWindow(emp);
        const shiftStart = window.start;
        const shiftEnd = window.end;

        const startM = moment(shiftStart, ["HH:mm", "hh:mm A"]);
        const endM = moment(shiftEnd, ["HH:mm", "hh:mm A"]);
        const worked = endM.diff(startM, 'minutes');

        const newAtt = new attendanceTbl({
          employeeId: empId,
          companyId: emp.companyId,
          branchId: emp.branchId,
          date,
          inTime: shiftStart,
          status: "Present",
          statusType: "Manual",
          inOutLogs: [{ inTime: shiftStart, outTime: shiftEnd }],
          workedMinutes: worked > 0 ? worked : 480,
          overtimeMinutes: 0,
          overtimeApproved: true
        });

        await newAtt.save();
        newAttendances.push(newAtt);
      }
    }
    res.status(200).json({ success: true, message: `Added ${newAttendances.length} records`, data: newAttendances });
  } catch (err) { res.status(500).json({ success: false, message: "Server Error" }); }
};

module.exports = {
  markAttendance,
  markSession,
  getAllAttendance,
  getAttendanceByEmployee,
  updateAttendance,
  adminApproveAction,
  deleteAttendance,
  bulkMarkAttendance,
  getMonthlyAttendance,
  syncPastAttendance ,
  removeDuplicates,
};