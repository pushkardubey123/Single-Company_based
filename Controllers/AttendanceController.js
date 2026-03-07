const attendanceTbl = require("../Modals/Attendance");
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

    const seen = new Set();
    const duplicateIds = [];

    for (const record of allRecords) {
      try {
          if (!record.employeeId || !record.date) continue;

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
    res.status(500).json({ success: false, message: err.message });
  }
};


const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const PROFILE_DIR = path.join(UPLOADS_DIR, "profiles");
if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

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

const isShiftOver = (currentTime, shiftEndTime) => {
    const now = moment(currentTime, "hh:mm:ss A");
    const end = moment(shiftEndTime, ["HH:mm", "hh:mm A", "h:mm A"]);
    
    return now.isAfter(end);
};

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
// 4. ADMIN APPROVE ACTION & MANAGE OVERTIME
const adminApproveAction = async (req, res) => {
  try {
    // 🚀 Frontend se bheja gaya accurate data receive karo
    const { attendanceId, action, manualOutTime, overtimeMinutes, approveOT } = req.body;
    
    const attendance = await attendanceTbl.findById(attendanceId).populate('employeeId');
    if (!attendance) return res.status(404).json({ message: "Record not found" });

    // --- A. FIX MISSING CHECKOUT ---
    if (action === "MANUAL_CHECKOUT") {
      const lastLog = attendance.inOutLogs[attendance.inOutLogs.length - 1];
      if (lastLog && !lastLog.outTime) {
        const window = await getEffectiveWindow(attendance.employeeId);
        
        if (manualOutTime) {
            lastLog.outTime = manualOutTime; 
        } else {
            // Auto Shift End Time
            const endM = moment(window.end, ["HH:mm", "hh:mm A"]);
            lastLog.outTime = endM.format("hh:mm:ss A");
        }
        attendance.statusType = "Manual";

        // Checkout hone par metrics automatically calculate karo
        const metrics = calculateMetrics(attendance.inOutLogs, window.start, window.end);
        attendance.workedMinutes = metrics.workedMinutes;
        attendance.overtimeMinutes = metrics.overtimeMinutes;
        // Agar overtime nahi hai, to by default true rakho, warna false (taaki admin check kare)
        attendance.overtimeApproved = metrics.overtimeMinutes <= 0;
      }
    } 
    // --- B. MANAGE OVERTIME (APPROVE & EDIT) ---
    else if (action === "UPDATE_OT") {
      // 🚀 Admin ne Overtime manually edit ya approve kiya hai
      if (overtimeMinutes !== undefined) {
          attendance.overtimeMinutes = Number(overtimeMinutes) || 0;
      }
      if (approveOT !== undefined) {
          attendance.overtimeApproved = Boolean(approveOT);
      }
    }

    await attendance.save();
    res.json({ success: true, message: "Action Completed Successfully", data: attendance });

  } catch (err) {
    console.error("Approve Action Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};
const getMonthlyAttendance = async (req, res) => {
  try {
    const { month } = req.query;
    const companyId = req.companyId;

    if (!month) {
      return res.status(400).json({
        success: false,
        message: "Month required"
      });
    }

    const startOfMonth = moment
      .tz(month, "YYYY-MM", "Asia/Kolkata")
      .startOf("month");

    const endOfMonth = moment
      .tz(month, "YYYY-MM", "Asia/Kolkata")
      .endOf("month");

    const daysInMonth = startOfMonth.daysInMonth();

    /* ================= EMPLOYEES ================= */

    const employees = await userTbl.find({
      companyId,
      role: "employee",
      status: "active"
    });

    /* ================= ATTENDANCE ================= */

    const records = await attendanceTbl.find({
      companyId,
      date: {
        $gte: startOfMonth.toDate(),
        $lte: endOfMonth.toDate()
      }
    });

    /* ================= LEAVES ================= */

    const leaves = await Leave.find({
      companyId,
      status: "Approved",
      startDate: { $lte: endOfMonth.toDate() },
      endDate: { $gte: startOfMonth.toDate() }
    });

    /* ================= HOLIDAYS ================= */

    const holidays = await Holiday.find({ companyId });

    /* ================= SETTINGS ================= */

    let settings = await LeaveSettings.findOne({ companyId });
    if (!settings) settings = { isSaturdayOff: true, isSundayOff: true };

    /* ================= FINAL RESULT ================= */

    const result = employees.map(emp => {

      let attendance = {};
      let present = 0;
      let absent = 0;
      let late = 0;
      let leave = 0;

      for (let day = 1; day <= daysInMonth; day++) {

        const date = startOfMonth.clone().date(day);
        const dateStr = date.format("YYYY-MM-DD");
        const dayOfWeek = date.day();

        /* ===== FIND ATTENDANCE ===== */

        const record = records.find(r =>
          r.employeeId.toString() === emp._id.toString() &&
          moment(r.date).format("YYYY-MM-DD") === dateStr
        );

        /* ===== FIND LEAVE ===== */

        const leaveRecord = leaves.find(l =>
          l.employeeId.toString() === emp._id.toString() &&
          moment(dateStr).isBetween(
            moment(l.startDate),
            moment(l.endDate),
            "day",
            "[]"
          )
        );

        /* ===== FIND HOLIDAY ===== */

        const holiday = holidays.find(h =>
          moment(dateStr).isBetween(
            moment(h.startDate),
            moment(h.endDate),
            "day",
            "[]"
          )
        );

        /* ================= LOGIC ================= */

        if (record) {

          attendance[day] = record.status;

          if (record.status === "Present") present++;
          if (record.status === "Late") late++;
          if (record.status === "On Leave") leave++;
          if (record.status === "Absent") absent++;

        } else if (leaveRecord) {

          attendance[day] = "On Leave";
          leave++;

        } else if (holiday) {

          attendance[day] = "Holiday";

        } else if (
          (dayOfWeek === 0 && settings.isSundayOff) ||
          (dayOfWeek === 6 && settings.isSaturdayOff)
        ) {

          attendance[day] = "Weekly Off";

        } else {

          attendance[day] = "Absent";
          absent++;
        }
      }

      return {
        employeeId: emp._id,
        name: emp.name,
        attendance,
        present,
        absent,
        late,
        leave
      };
    });

    res.json({
      success: true,
      data: result
    });

  } catch (err) {

    console.error("Monthly Attendance Error:", err);

    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
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
    const { id } = req.params;
    if (!id || id === "undefined") {
      return res.status(400).json({ success: false, message: "Invalid Employee ID" });
    }
    const data = await attendanceTbl.find({ employeeId: id }).sort({ date: -1 });
    res.status(200).json({ success: true, data });
  } catch (err) { 
    res.status(500).json({ success: false, message: "Server Error" }); 
  }
};

const deleteAttendance = async (req, res) => {
  try {
    const deleted = await attendanceTbl.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Not found" });
    res.status(200).json({ success: true, message: "Deleted" });
  } catch (err) { res.status(500).json({ success: false, message: "Server Error" }); }
};

// ====== AttendanceController.js ======

const bulkMarkAttendance = async (req, res) => {
  try {
    const { employeeIds, startDate, endDate } = req.body;
    const companyId = req.companyId; // Middleware se companyId le rahe hain
    
    if (!employeeIds || employeeIds.length === 0 || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const start = moment.tz(startDate, "YYYY-MM-DD", "Asia/Kolkata").startOf('day');
    const end = moment.tz(endDate, "YYYY-MM-DD", "Asia/Kolkata").startOf('day');

    if (end.isBefore(start)) {
      return res.status(400).json({ success: false, message: "End Date cannot be before Start Date" });
    }

    // 🔥 1. Get Company Settings for Weekends and Holidays
    let settings = await LeaveSettings.findOne({ companyId });
    if (!settings) settings = { isSaturdayOff: true, isSundayOff: true };
    const holidays = await Holiday.find({ companyId });

    const employees = await userTbl.find({ _id: { $in: employeeIds } }).populate('shiftId');
    let processedCount = 0; 

    for (const emp of employees) {
      const window = await getEffectiveWindow(emp);
      const shiftStart = window.start || "09:00 AM";
      const shiftEnd = window.end || "06:00 PM";

      const startM = moment(shiftStart, ["HH:mm", "hh:mm A"]);
      const finishM = moment(shiftEnd, ["HH:mm", "hh:mm A"]);
      const worked = finishM.diff(startM, 'minutes');

      let loopDate = start.clone();
      
      while (loopDate.isSameOrBefore(end)) {
        const currentDateStart = loopDate.clone().startOf('day').toDate();
        const currentDateEnd = loopDate.clone().endOf('day').toDate();
        const dateStr = loopDate.format("YYYY-MM-DD");
        const dayOfWeek = loopDate.day(); // 0 = Sunday, 6 = Saturday

        // 🔥 2. Decide the Target Status (Default is Present)
        let targetStatus = "Present";

        // Check Weekly Off
        if ((dayOfWeek === 0 && settings.isSundayOff) || (dayOfWeek === 6 && settings.isSaturdayOff)) {
          targetStatus = "Weekly Off";
        }

        // Check Holidays
        const isHoliday = holidays.some(h => {
          const hStart = moment(h.startDate).format("YYYY-MM-DD");
          const hEnd = moment(h.endDate).format("YYYY-MM-DD");
          return dateStr >= hStart && dateStr <= hEnd;
        });

        if (isHoliday) {
          targetStatus = "Holiday";
        }

        // Check if attendance already exists
        const exists = await attendanceTbl.findOne({
          employeeId: emp._id,
          date: { $gte: currentDateStart, $lte: currentDateEnd },
        });

        const safeDate = loopDate.clone().add(12, 'hours').toDate();

        if (!exists) {
          // CONDITION 1: Create New Record
          const newAtt = new attendanceTbl({
            employeeId: emp._id,
            companyId: emp.companyId,
            branchId: emp.branchId,
            date: safeDate, 
            inTime: targetStatus === "Present" ? shiftStart : "00:00",
            outTime: targetStatus === "Present" ? shiftEnd : "00:00",
            status: targetStatus,
            statusType: "Manual",
            inOutLogs: targetStatus === "Present" ? [{ inTime: shiftStart, outTime: shiftEnd }] : [],
            workedMinutes: targetStatus === "Present" ? (worked > 0 ? worked : 480) : 0,
            overtimeMinutes: 0,
            overtimeApproved: true,
            adminCheckoutTime: targetStatus !== "Present" ? targetStatus : undefined
          });

          await newAtt.save();
          processedCount++;
          
        } else if (exists.status === "Absent") {
          // CONDITION 2: Update "Absent" to correct status (Present / Weekly Off / Holiday)
          exists.status = targetStatus;
          exists.statusType = "Manual";
          exists.inTime = targetStatus === "Present" ? shiftStart : "00:00";
          exists.outTime = targetStatus === "Present" ? shiftEnd : "00:00";
          exists.inOutLogs = targetStatus === "Present" ? [{ inTime: shiftStart, outTime: shiftEnd }] : [];
          exists.workedMinutes = targetStatus === "Present" ? (worked > 0 ? worked : 480) : 0;
          exists.overtimeMinutes = 0;
          exists.overtimeApproved = true;
          
          if(targetStatus !== "Present") {
            exists.adminCheckoutTime = targetStatus;
          }

          await exists.save();
          processedCount++;
        }
        
        loopDate.add(1, 'days');
      }
    }

    res.status(200).json({ 
      success: true, 
      message: `Successfully processed! Added/Updated ${processedCount} records.`, 
    });

  } catch (err) { 
    console.error("Bulk Mark Error:", err);
    res.status(500).json({ success: false, message: "Server Error" }); 
  }
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