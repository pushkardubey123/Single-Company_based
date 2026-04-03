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
const WorkFromHome = require("../Modals/WFH"); // ✅ WFH ADDED

// --- HELPER FUNCTIONS ---
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
  } catch (err) { return null; }
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
    const baseDate = moment().format("YYYY-MM-DD");
    const shiftEndMoment = moment(`${baseDate} ${windowEnd}`, ["YYYY-MM-DD HH:mm", "YYYY-MM-DD hh:mm A"]);

    logs.forEach(log => {
        if (log.inTime && log.outTime) {
            const inTimeMoment = moment(`${baseDate} ${log.inTime}`, "YYYY-MM-DD hh:mm:ss A");
            const outTimeMoment = moment(`${baseDate} ${log.outTime}`, "YYYY-MM-DD hh:mm:ss A");
            
            const sessionDuration = outTimeMoment.diff(inTimeMoment, 'minutes');
            workedMinutes += sessionDuration > 0 ? sessionDuration : 0;

            if (outTimeMoment.isAfter(shiftEndMoment)) {
                let effectiveStart = inTimeMoment.isAfter(shiftEndMoment) ? inTimeMoment : shiftEndMoment;
                const otDuration = outTimeMoment.diff(effectiveStart, 'minutes');
                overtimeMinutes += otDuration > 0 ? otDuration : 0;
            }
        }
    });
    return { workedMinutes, overtimeMinutes };
};

// --- CONTROLLERS ---

const markAttendance = async (req, res) => {
  try {
    const { latitude, longitude, liveImage } = req.body;
    const employeeId = req.user._id;

    if (!employeeId || typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({ success: false, message: "Missing location fields" });
    }

    const employee = await userTbl.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    const window = await getEffectiveWindow(employee);
    const currentTime = getCurrentTime();
    
    if (isShiftOver(currentTime, window.end)) {
        return res.status(403).json({ success: false, message: "Shift is over. Cannot mark attendance now." });
    }

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

    let branchInfo = await getBranchLocation(employee.branchId);
    let allowedLat = branchInfo ? branchInfo.latitude : officeLocation.latitude;
    let allowedLon = branchInfo ? branchInfo.longitude : officeLocation.longitude;
    let radius = branchInfo ? branchInfo.radius : 200;

    if (!isWithinBranchRange(latitude, longitude, allowedLat, allowedLon, radius)) {
      return res.status(403).json({ success: false, message: "Outside allowed location" });
    }

    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();
    const existing = await attendanceTbl.findOne({ employeeId, date: { $gte: todayStart, $lte: todayEnd } });
    if (existing) return res.status(400).json({ success: false, message: "Already marked today" });

    const shiftStart = moment(window.start, ["HH:mm", "hh:mm A"]);
    const currentMoment = moment.tz("Asia/Kolkata");
    const status = currentMoment.isAfter(shiftStart.add(15, 'minutes')) ? "Late" : "Present";

    const attendance = new attendanceTbl({
      employeeId, companyId: employee.companyId, branchId: employee.branchId,
      date: getISTDate(), inTime: currentTime, location: { latitude, longitude },
      status, statusType: "Auto", inOutLogs: [{ inTime: currentTime, outTime: null }]
    });

    await attendance.save();
    res.status(201).json({ success: true, message: `Marked In Successfully`, data: attendance });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const markSession = async (req, res) => {
  try {
    const { latitude, longitude, actionType } = req.body;
    const employeeId = req.user._id;

    if (!employeeId || !["in", "out"].includes(actionType)) return res.status(400).json({ success: false, message: "Invalid data" });

    const employee = await userTbl.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, message: "User not found" });

    const window = await getEffectiveWindow(employee);
    const currentTime = getCurrentTime();

    if (actionType === "in") {
        if (isShiftOver(currentTime, window.end)) {
            return res.status(403).json({ success: false, message: "Shift is over. Cannot start new session." });
        }
    }

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

    if (actionType === "in") {
        if (!lastLog || lastLog.outTime) attendance.inOutLogs.push({ inTime: currentTime, outTime: null });
        else return res.status(400).json({ success: false, message: "Already checked in" });
    } 
    
    if (actionType === "out") {
        if (lastLog && !lastLog.outTime) {
            lastLog.outTime = currentTime;
            const metrics = calculateMetrics(attendance.inOutLogs, window.start, window.end);
            
            attendance.workedMinutes = metrics.workedMinutes;
            attendance.overtimeMinutes = metrics.overtimeMinutes;
            attendance.overtimeApproved = metrics.overtimeMinutes <= 0;

            // 🔥 ZOHO / HRONE RULE: SHORT WORKING HOURS = AUTO HALF DAY 🔥
            const halfDayThreshold = 5 * 60; // 5 hours
            const absentThreshold = 2 * 60;  // 2 hours

            if (attendance.workedMinutes < halfDayThreshold && attendance.workedMinutes > absentThreshold) {
                attendance.status = "Half Day";
                attendance.statusType = "Auto";
                attendance.adminCheckoutTime = "Short Hours - Auto Half Day";
            } else if (attendance.workedMinutes <= absentThreshold) {
                attendance.status = "Absent";
                attendance.statusType = "Auto";
                attendance.adminCheckoutTime = "Very Short Hours - Auto Absent";
            }

        } else return res.status(400).json({ success: false, message: "Already checked out" });
    }

    await attendance.save();
    res.status(200).json({ success: true, message: `Checked ${actionType} successfully`, data: attendance });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const { status, statusType } = req.body;
    let updateData = { status, statusType: statusType || "Manual" };

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

const adminApproveAction = async (req, res) => {
  try {
    const { attendanceId, action, manualOutTime, overtimeMinutes, approveOT } = req.body;
    const attendance = await attendanceTbl.findById(attendanceId).populate('employeeId');
    if (!attendance) return res.status(404).json({ message: "Record not found" });

    if (action === "MANUAL_CHECKOUT") {
      const lastLog = attendance.inOutLogs[attendance.inOutLogs.length - 1];
      if (lastLog && !lastLog.outTime) {
        const window = await getEffectiveWindow(attendance.employeeId);
        
        if (manualOutTime) {
            lastLog.outTime = manualOutTime; 
        } else {
            const endM = moment(window.end, ["HH:mm", "hh:mm A"]);
            lastLog.outTime = endM.format("hh:mm:ss A");
        }
        attendance.statusType = "Manual";

        const metrics = calculateMetrics(attendance.inOutLogs, window.start, window.end);
        attendance.workedMinutes = metrics.workedMinutes;
        attendance.overtimeMinutes = metrics.overtimeMinutes;
        attendance.overtimeApproved = metrics.overtimeMinutes <= 0;

        // Auto Rule for forced checkout
        const halfDayThreshold = 5 * 60; 
        const absentThreshold = 2 * 60;  
        if (attendance.workedMinutes < halfDayThreshold && attendance.workedMinutes > absentThreshold) {
            attendance.status = "Half Day";
            attendance.adminCheckoutTime = "Short Hours - Admin Forced Checkout";
        } else if (attendance.workedMinutes <= absentThreshold) {
            attendance.status = "Absent";
            attendance.adminCheckoutTime = "Very Short Hours - Admin Forced Checkout";
        }
      }
    } 
    else if (action === "UPDATE_OT") {
      if (overtimeMinutes !== undefined) attendance.overtimeMinutes = Number(overtimeMinutes) || 0;
      if (approveOT !== undefined) attendance.overtimeApproved = Boolean(approveOT);
    }

    await attendance.save();
    res.json({ success: true, message: "Action Completed Successfully", data: attendance });

  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

const getMonthlyAttendance = async (req, res) => {
  try {
    const { month } = req.query;
    const companyId = req.companyId;

    if (!month) return res.status(400).json({ success: false, message: "Month required" });

    const startOfMonth = moment.tz(month, "YYYY-MM", "Asia/Kolkata").startOf("month");
    const endOfMonth = moment.tz(month, "YYYY-MM", "Asia/Kolkata").endOf("month");
    const daysInMonth = startOfMonth.daysInMonth();

    const employees = await userTbl.find({ companyId, role: "employee", status: "active" });
    const records = await attendanceTbl.find({ companyId, date: { $gte: startOfMonth.toDate(), $lte: endOfMonth.toDate() } });
    const leaves = await Leave.find({ companyId, status: "Approved", startDate: { $lte: endOfMonth.toDate() }, endDate: { $gte: startOfMonth.toDate() } });
    const wfhRecords = await WorkFromHome.find({ companyId, status: "approved", fromDate: { $lte: endOfMonth.toDate() }, toDate: { $gte: startOfMonth.toDate() } });
    const holidays = await Holiday.find({ companyId });

    let settings = await LeaveSettings.findOne({ companyId });
    if (!settings) settings = { isSaturdayOff: true, isSundayOff: true };

    const result = employees.map(emp => {
      let attendance = {};
      let present = 0, absent = 0, late = 0, leave = 0, halfDay = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const date = startOfMonth.clone().date(day);
        const dateStr = date.format("YYYY-MM-DD");
        const dayOfWeek = date.day();

        const record = records.find(r => r.employeeId.toString() === emp._id.toString() && moment(r.date).format("YYYY-MM-DD") === dateStr);
        const leaveRecord = leaves.find(l => l.employeeId.toString() === emp._id.toString() && moment(dateStr).isBetween(moment(l.startDate), moment(l.endDate), "day", "[]"));
        const holiday = holidays.find(h => moment(dateStr).isBetween(moment(h.startDate), moment(h.endDate), "day", "[]"));
        const isWfh = wfhRecords.find(w => w.userId.toString() === emp._id.toString() && moment(dateStr).isBetween(moment(w.fromDate), moment(w.toDate), "day", "[]"));

        if (record) {
          attendance[day] = record.status;
          if (record.status === "Present" || record.status === "WFH") present++;
          if (record.status === "Late") late++;
          if (record.status === "On Leave") leave++;
          if (record.status === "Absent") absent++;
          if (record.status === "Half Day") halfDay++;
        } else if (isWfh) {
          attendance[day] = "WFH";
          present++;
        } else if (leaveRecord) {
          attendance[day] = "On Leave";
          leave++;
        } else if (holiday) {
          attendance[day] = "Holiday";
        } else if ((dayOfWeek === 0 && settings.isSundayOff) || (dayOfWeek === 6 && settings.isSaturdayOff)) {
          attendance[day] = "Weekly Off";
        } else {
          attendance[day] = "Absent";
          absent++;
        }
      }

      return { employeeId: emp._id, name: emp.name, attendance, present, absent, late, leave, halfDay };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getAllAttendance = async (req, res) => {
  try {
    const all = await attendanceTbl.find({ companyId: req.companyId }).populate("employeeId", "name email").populate("branchId", "name").sort({ date: -1 });
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
    if (!id || id === "undefined") return res.status(400).json({ success: false, message: "Invalid Employee ID" });
    const data = await attendanceTbl.find({ employeeId: id }).sort({ date: -1 });
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

const syncPastAttendance = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const companyId = req.companyId;

    let filter = { companyId, role: "employee", status: "active" };
    if (employeeId) filter._id = employeeId;
    const employees = await userTbl.find(filter);

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

        let attendance = await attendanceTbl.findOne({
          employeeId: emp._id, date: { $gte: todayStart, $lte: todayEnd }
        });

        let targetStatus = "Absent";
        let remarks = "System Auto";

        if ((dayOfWeek === 0 && settings.isSundayOff) || (dayOfWeek === 6 && settings.isSaturdayOff)) {
          targetStatus = "Weekly Off";
        }

        const isHoliday = holidays.some(h => {
             const hStart = moment(h.startDate).format("YYYY-MM-DD");
             const hEnd = moment(h.endDate).format("YYYY-MM-DD");
             return dateStr >= hStart && dateStr <= hEnd;
        });
        if (isHoliday) { targetStatus = "Holiday"; remarks = "Holiday"; }

        if (targetStatus === "Absent") {
            const leave = await Leave.findOne({
              employeeId: emp._id, status: "Approved",
              startDate: { $lte: todayEnd }, endDate: { $gte: todayStart }
            });
            if (leave) { targetStatus = "On Leave"; remarks = leave.leaveType; }
        }

        // 🔥 WFH CHECK 🔥
        if (targetStatus === "Absent") {
            const wfh = await WorkFromHome.findOne({
                userId: emp._id, status: "approved",
                fromDate: { $lte: todayEnd }, toDate: { $gte: todayStart }
            });
            if (wfh) { targetStatus = "WFH"; remarks = "Approved WFH"; }
        }

        if (!attendance) {
            await attendanceTbl.create({
                employeeId: emp._id, companyId, branchId: emp.branchId,
                date: loopDate.toDate(), inTime: "00:00", outTime: "00:00",
                status: targetStatus, statusType: "Auto", inOutLogs: [],
                workedMinutes: 0, overtimeMinutes: 0, adminCheckoutTime: remarks
            });
            updatedCount++;
        } 
        else {
            if (attendance.status === "Absent" && (targetStatus === "On Leave" || targetStatus === "WFH")) {
                attendance.status = targetStatus;
                attendance.adminCheckoutTime = remarks; 
                await attendance.save();
                updatedCount++;
            }
        }
        loopDate.add(1, 'days');
      }
    }
    res.json({ success: true, message: `Sync Processed. Updated/Created ${updatedCount} records.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const bulkMarkAttendance = async (req, res) => {
  try {
    const { employeeIds, startDate, endDate } = req.body;
    const companyId = req.companyId; 
    
    if (!employeeIds || employeeIds.length === 0 || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const start = moment.tz(startDate, "YYYY-MM-DD", "Asia/Kolkata").startOf('day');
    const end = moment.tz(endDate, "YYYY-MM-DD", "Asia/Kolkata").startOf('day');

    if (end.isBefore(start)) return res.status(400).json({ success: false, message: "End Date cannot be before Start Date" });

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
        const dayOfWeek = loopDate.day(); 

        let targetStatus = "Present";

        if ((dayOfWeek === 0 && settings.isSundayOff) || (dayOfWeek === 6 && settings.isSaturdayOff)) targetStatus = "Weekly Off";

        const isHoliday = holidays.some(h => {
          const hStart = moment(h.startDate).format("YYYY-MM-DD");
          const hEnd = moment(h.endDate).format("YYYY-MM-DD");
          return dateStr >= hStart && dateStr <= hEnd;
        });
        if (isHoliday) targetStatus = "Holiday";

        // 🔥 WFH CHECK FOR BULK 🔥
        if (targetStatus === "Present") {
            const isWFH = await WorkFromHome.findOne({
                userId: emp._id, status: "approved",
                fromDate: { $lte: currentDateEnd }, toDate: { $gte: currentDateStart }
            });
            if (isWFH) targetStatus = "WFH";
        }

        const exists = await attendanceTbl.findOne({
          employeeId: emp._id, date: { $gte: currentDateStart, $lte: currentDateEnd },
        });

        const safeDate = loopDate.clone().add(12, 'hours').toDate();

        if (!exists) {
          const isWorkingDay = targetStatus === "Present" || targetStatus === "WFH";
          const newAtt = new attendanceTbl({
            employeeId: emp._id, companyId: emp.companyId, branchId: emp.branchId,
            date: safeDate, 
            inTime: isWorkingDay ? shiftStart : "00:00",
            outTime: isWorkingDay ? shiftEnd : "00:00",
            status: targetStatus, statusType: "Manual",
            inOutLogs: isWorkingDay ? [{ inTime: shiftStart, outTime: shiftEnd }] : [],
            workedMinutes: isWorkingDay ? (worked > 0 ? worked : 480) : 0,
            overtimeMinutes: 0, overtimeApproved: true,
            adminCheckoutTime: !isWorkingDay ? targetStatus : undefined
          });

          await newAtt.save();
          processedCount++;
          
        } else if (exists.status === "Absent") {
          const isWorkingDay = targetStatus === "Present" || targetStatus === "WFH";
          exists.status = targetStatus;
          exists.statusType = "Manual";
          exists.inTime = isWorkingDay ? shiftStart : "00:00";
          exists.outTime = isWorkingDay ? shiftEnd : "00:00";
          exists.inOutLogs = isWorkingDay ? [{ inTime: shiftStart, outTime: shiftEnd }] : [];
          exists.workedMinutes = isWorkingDay ? (worked > 0 ? worked : 480) : 0;
          exists.overtimeMinutes = 0;
          exists.overtimeApproved = true;
          
          if(!isWorkingDay) exists.adminCheckoutTime = targetStatus;

          await exists.save();
          processedCount++;
        }
        loopDate.add(1, 'days');
      }
    }
    res.status(200).json({ success: true, message: `Successfully processed! Added/Updated ${processedCount} records.` });
  } catch (err) { res.status(500).json({ success: false, message: "Server Error" }); }
};

const removeDuplicates = async (req, res) => {
  try {
    if (!req.companyId) throw new Error("STOP: Company ID is undefined in Controller!");
    const allRecords = await attendanceTbl.find({ 
        companyId: req.companyId, employeeId: { $ne: null } 
    }).sort({ createdAt: -1 });

    const seen = new Set();
    const duplicateIds = [];

    for (const record of allRecords) {
      try {
          if (!record.employeeId || !record.date) continue;
          const empIdStr = record.employeeId.toString(); 
          const dateStr = moment(record.date).format("YYYY-MM-DD");
          const key = `${empIdStr}-${dateStr}`;

          if (seen.has(key)) duplicateIds.push(record._id);
          else seen.add(key);
      } catch (innerErr) { continue; }
    }

    if (duplicateIds.length > 0) {
      await attendanceTbl.deleteMany({ _id: { $in: duplicateIds } });
    }
    res.json({ success: true, message: `Cleanup done. Removed ${duplicateIds.length} duplicates.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  markAttendance, markSession, updateAttendance, adminApproveAction, getMonthlyAttendance,
  getAllAttendance, getAttendanceByEmployee, deleteAttendance, bulkMarkAttendance,
  syncPastAttendance, removeDuplicates, calculateMetrics, getEffectiveWindow 
};