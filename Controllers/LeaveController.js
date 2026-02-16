const leaveTbl = require("../Modals/Leave");
const moment = require("moment");
const mongoose = require("mongoose"); // ✅ Required for ObjectId casting
const LeaveBalance = require("../Modals/Leave/LeaveBalance");
const LeaveType = require("../Modals/Leave/LeaveType");
const Leave = require("../Modals/Leave");
const Holiday = require("../Modals/Leave/Holiday");
const LeaveSettings = require("../Modals/Leave/LeaveSettings");


const getLeaveReport = async (req, res) => {
  try {
    const { type, month, year } = req.query;
    let start, end;
    if (type === "Monthly") {
      if (!month) return res.status(400).json({ success: false, message: "Month is required" });
      start = moment(month, "YYYY-MM").startOf("month").toDate();
      end = moment(month, "YYYY-MM").endOf("month").toDate();
    } else if (type === "Yearly") {
      if (!year) return res.status(400).json({ success: false, message: "Year is required" });
      start = moment(year, "YYYY").startOf("year").toDate();
      end = moment(year, "YYYY").endOf("year").toDate();
    } else {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }

    // ✅ FIX 1: Ensure CompanyId is ObjectId
    const companyIdObject = new mongoose.Types.ObjectId(req.companyId);

    // ✅ FIX 2: Better Logic (Leaves jo is mahine ACTIVE thin, na ki bas start hui thin)
    // Agar leave Dec 25 ko start hui aur Jan 5 ko khatam hui, to wo Jan ki report me dikhni chahiye.
    // Logic: (LeaveStart <= MonthEnd) AND (LeaveEnd >= MonthStart)
    const filter = {
      companyId: companyIdObject,
      startDate: { $lte: end }, // Start date month end se pehle honi chahiye
      endDate: { $gte: start }  // End date month start ke baad honi chahiye
    };

    // Branch Filter (Only if not Admin)
    if (req.user.role !== 'admin' && req.user.branchId) {
      filter.branchId = req.user.branchId;
    }
    
    const leaves = await leaveTbl
      .find(filter)
      .populate("employeeId", "name email profileImage role")
      .sort({ startDate: -1 });


    res.json({
      success: true,
      data: leaves,
    });
  } catch (err) {
    console.error("❌ Error fetching leave report:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
;

/**
 * Calculates effective leave days excluding Weekends and Holidays
 */

const calculateLeaveDays = async (startDate, endDate, companyId) => {
  const start = moment(startDate);
  const end = moment(endDate);
  
  if (end.isBefore(start)) throw new Error("End date cannot be before start date");

  // 1. Settings lao (Saturday/Sunday Off hai ya nahi?)
  let settings = await LeaveSettings.findOne({ companyId });
  if (!settings) settings = { isSaturdayOff: true, isSundayOff: true };

  // 2. Holidays lao jo is range ke beech me pad rahe hain
  // Example: Agar Holiday 12-13 ko hai, aur Leave 11-14 hai, to wo holiday yahan fetch hoga.
  const holidays = await Holiday.find({
    companyId,
    $or: [
      { startDate: { $lte: end.toDate() }, endDate: { $gte: start.toDate() } }
    ]
  });

  let effectiveDays = 0;
  let currentDate = start.clone();

  // 3. Loop: Har ek din check karo (11, 12, 13, 14...)
  while (currentDate.isSameOrBefore(end)) {
    const dayOfWeek = currentDate.day(); // 0=Sun, 1=Mon, ..., 6=Sat
    const currentDateStr = currentDate.format("YYYY-MM-DD"); // Date ko string bana lo comparison ke liye

    let isOff = false; // Maan ke chalo aaj chutti nahi hai

    // --- A. Weekend Check ---
    if (dayOfWeek === 0 && settings.isSundayOff) isOff = true; // Agar Sunday hai aur off hai -> Skip
    if (dayOfWeek === 6 && settings.isSaturdayOff) isOff = true; // Agar Saturday hai aur off hai -> Skip

    // --- B. Holiday Check ---
    // Agar Weekend nahi tha, to check karo kya aaj Holiday hai?
    if (!isOff) {
      const isHoliday = holidays.some(h => {
        const hStart = moment(h.startDate).format("YYYY-MM-DD");
        const hEnd = moment(h.endDate).format("YYYY-MM-DD");
        // Check karo ki current date holiday range ke beech me hai kya
        return currentDateStr >= hStart && currentDateStr <= hEnd;
      });

      if (isHoliday) isOff = true; // Agar Holiday list me mil gaya -> Skip
    }

    // --- C. Result Calculation ---
    if (!isOff) {
      // ✅ Agar na Weekend hai, na Holiday hai, tabhi count badhao
      effectiveDays++;
    } else {
      // ❌ Agar Weekend ya Holiday hai, to yahan count nahi badhega (Minus ho gaya)
      console.log(`Skipping ${currentDateStr} (Weekend/Holiday)`);
    }

    // Agla din check karo
    currentDate.add(1, "days");
  }

  return effectiveDays;
};

// ... createLeave aur updateLeaveStatus function wahi rahenge ...
// Bas ensure karein ki createLeave me ye function call ho raha ho:

const createLeave = async (req, res) => {
  try {
    const { leaveTypeId, startDate, endDate, reason } = req.body;
    const employeeId = req.user._id;
    const companyId = req.companyId;

    if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Dates required" });

    // 1. Calculate Days (Using the logic above)
    // Example: User ne 11 se 14 dala. Function ne 12, 13 (Holidays) ko skip kiya.
    // Result: effectiveDays = 2 ayega.
    const effectiveDays = await calculateLeaveDays(startDate, endDate, companyId);

    if (effectiveDays === 0) {
      return res.status(400).json({ success: false, message: "Selected dates are all holidays or weekends." });
    }

    // 2. Validate Leave Type
    const leaveTypeDoc = await LeaveType.findById(leaveTypeId);
    if (!leaveTypeDoc) return res.status(404).json({ success: false, message: "Invalid Leave Type" });

    // 3. Balance Check Logic (Aapka existing code)
    const year = new Date(startDate).getFullYear();
    const balance = await LeaveBalance.findOne({ employeeId, leaveTypeId, year });

    if (!balance) return res.status(400).json({ success: false, message: "Balance record not found." });

    const available = (balance.totalCredited || 0) + (balance.carryForwarded || 0) - (balance.used || 0);

    if (effectiveDays > available) {
        return res.status(400).json({ 
            success: false, 
            message: `Insufficient Balance! You need ${effectiveDays} days, but have ${available}.` 
        });
    }

    // 4. Save Leave
    const leave = await Leave.create({
      employeeId,
      companyId,
      branchId: req.user.branchId || req.branchId, 
      leaveTypeId, 
      leaveType: leaveTypeDoc.name,
      startDate,
      endDate,
      reason,
      days: effectiveDays, // ✅ Database me sirf 2 din save honge
      status: "Pending"
    });

    res.status(201).json({ success: true, message: "Leave Applied", data: leave });

  } catch (err) {
    console.error("Create Leave Error:", err); 
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body; // "Approved" or "Rejected"
    const leaveId = req.params.id;

    // 1. Leave Dhundo
    const leave = await Leave.findById(leaveId);
    if (!leave) return res.status(404).json({ message: "Leave not found" });

    // Agar status change nahi ho raha, to wapas bhej do
    if (leave.status === status) {
      return res.json({ success: true, message: "Status updated" });
    }

    // 2. Days Calculation (Agar database me save nahi hua tha)
    let leaveDays = leave.days;
    if (!leaveDays) {
      const s = moment(leave.startDate);
      const e = moment(leave.endDate);
      leaveDays = e.diff(s, "days") + 1;
    }

    const year = moment(leave.startDate).year();

    // ===============================================
    // SCENARIO A: APPROVE (Balance Kato)
    // ===============================================
    if (status === "Approved" && leave.status !== "Approved") {
      
      // Balance check karo
      const balance = await LeaveBalance.findOne({
        employeeId: leave.employeeId,
        leaveTypeId: leave.leaveTypeId,
        year: year
      });

      if (!balance) {
        return res.status(400).json({ success: false, message: "Leave Balance not found for this user." });
      }

      // Available calculate karo
      const available = (balance.totalCredited || 0) + (balance.carryForwarded || 0) - (balance.used || 0);

      // Agar balance kam hai to error do
      if (leaveDays > available) {
        return res.status(400).json({ 
            success: false, 
            message: `Insufficient Balance! Available: ${available}, Required: ${leaveDays}` 
        });
      }

      // Balance Update (Used Badhao)
      await LeaveBalance.findOneAndUpdate(
        { _id: balance._id },
        { $inc: { used: leaveDays } }
      );
    }

    // ===============================================
    // SCENARIO B: REJECT (Agar pehle Approve tha to Wapas do)
    // ===============================================
    if (status === "Rejected" && leave.status === "Approved") {
      await LeaveBalance.findOneAndUpdate(
        { 
            employeeId: leave.employeeId, 
            leaveTypeId: leave.leaveTypeId, 
            year: year 
        },
        { $inc: { used: -leaveDays } } // Used ghata do (wapas mil jayega)
      );
    }

    // 3. Final Status Save
    leave.status = status;
    if (!leave.days) leave.days = leaveDays; // Save days for future reference
    await leave.save();

    res.json({ success: true, message: `Leave ${status} successfully`, data: leave });

  } catch (err) {
    console.error("❌ UPDATE ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ... Baaki functions same rahenge (getAllLeaves, getLeaveById etc.) ...



const getAllLeaves = async (req, res) => {
  try {
    const filter = {
  companyId: req.companyId,
};

if (req.user.role !== "admin") {
  filter.branchId = req.user.branchId;
}

const data = await leaveTbl
  .find(filter)
  .populate("employeeId", "name email");


    res.json({
      success: true,
      data,
    });
  } catch {
    res.status(500).json({ success: false });
  }
};

const getLeavesByEmployee = async (req, res) => {
  try {
    const filter = { 
      employeeId: req.params.id, 
      companyId: req.companyId 
    };

    // Agar user admin nahi hai, tabhi branch ka filter lagao
    if (req.user.role !== 'admin') {
      filter.branchId = req.user.branchId;
    }

    const leaves = await leaveTbl.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getLeaveById = async (req, res) => {
  try {
    const data = await leaveTbl
      .findOne({
        _id: req.params.id,
        companyId: req.companyId,
        branchId: req.user.branchId,
      })
      .populate("employeeId", "name email");

    if (!data) {
      return res.status(404).json({ success: false });
    }

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false });
  }
};


const deleteLeave = async (req, res) => {
  try {
    const deleted = await leaveTbl.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId,
      branchId: req.user.branchId,
    });

    if (!deleted) {
      return res.status(404).json({ success: false });
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
};

module.exports = {
  createLeave,
  getAllLeaves,
  getLeaveById,
  updateLeaveStatus,
  deleteLeave,
  getLeavesByEmployee,
  getLeaveReport,
};
