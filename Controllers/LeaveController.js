const leaveTbl = require("../Modals/Leave");
const moment = require("moment");
const mongoose = require("mongoose");
const LeaveBalance = require("../Modals/Leave/LeaveBalance");
const LeaveType = require("../Modals/Leave/LeaveType");
const Leave = require("../Modals/Leave");
const Holiday = require("../Modals/Leave/Holiday");
const LeaveSettings = require("../Modals/Leave/LeaveSettings");
const User = require("../Modals/User"); // ✅ Need this to fetch emails
const sendEmail = require("../utils/sendEmail"); // ✅ Import Email Utility


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

    const companyIdObject = new mongoose.Types.ObjectId(req.companyId);

    const filter = {
      companyId: companyIdObject,
      startDate: { $lte: end },
      endDate: { $gte: start } 
    };

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

/**
 * Calculates effective leave days excluding Weekends and Holidays
 */
const calculateLeaveDays = async (startDate, endDate, companyId) => {
  const start = moment(startDate).startOf('day');
  const queryEnd = moment(endDate).endOf('day'); 
  const loopEnd = moment(endDate).startOf('day');
  
  if (loopEnd.isBefore(start)) throw new Error("End date cannot be before start date");

  let settings = await LeaveSettings.findOne({ companyId });
  if (!settings) settings = { isSaturdayOff: true, isSundayOff: true };

  const holidays = await Holiday.find({
    companyId,
    startDate: { $lte: queryEnd.toDate() },
    endDate: { $gte: start.toDate() }
  });

  let effectiveDays = 0;
  let currentDate = start.clone();

  while (currentDate.isSameOrBefore(loopEnd)) {
    const dayOfWeek = currentDate.day(); 
    let isOff = false; 

    if (dayOfWeek === 0 && settings.isSundayOff) isOff = true; 
    if (dayOfWeek === 6 && settings.isSaturdayOff) isOff = true; 

    if (!isOff) {
      const isHoliday = holidays.some(h => {
        const hStart = moment(h.startDate).startOf('day');
        const hEnd = moment(h.endDate).startOf('day');
        return currentDate.isSameOrAfter(hStart) && currentDate.isSameOrBefore(hEnd);
      });
      if (isHoliday) isOff = true; 
    }

    if (!isOff) {
      effectiveDays++;
    }

    currentDate.add(1, "days");
  }

  return effectiveDays;
};

// ==========================================
// 1. APPLY LEAVE (Sends email to ADMIN)
// ==========================================
const createLeave = async (req, res) => {
  try {
    const { leaveTypeId, startDate, endDate, reason } = req.body;
    const employeeId = req.user._id;
    const companyId = req.companyId;

    if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Dates required" });

    const effectiveDays = await calculateLeaveDays(startDate, endDate, companyId);
    if (effectiveDays === 0) {
      return res.status(400).json({ success: false, message: "Selected dates are all holidays or weekends." });
    }

    const leaveTypeDoc = await LeaveType.findById(leaveTypeId);
    if (!leaveTypeDoc) return res.status(404).json({ success: false, message: "Invalid Leave Type" });

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

    const leave = await Leave.create({
      employeeId,
      companyId,
      branchId: req.user.branchId || req.branchId, 
      leaveTypeId, 
      leaveType: leaveTypeDoc.name,
      startDate,
      endDate,
      reason,
      days: effectiveDays,
      status: "Pending"
    });

    // 🔥 SEND EMAIL TO ADMIN IN BACKGROUND
    try {
        const [adminUser, employeeUser] = await Promise.all([
            User.findById(companyId), // admin is typically the companyId
            User.findById(employeeId)
        ]);

        if (adminUser && adminUser.email) {
            const adminHtml = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #4f46e5; padding: 15px; color: #fff; text-align: center;">
                        <h2 style="margin: 0;">New Leave Request</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>Dear Admin,</p>
                        <p>A new leave request has been submitted by <strong>${employeeUser.name}</strong> and is pending your approval.</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; background: #f8fafc; font-weight: bold; width: 35%;">Employee Name</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${employeeUser.name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; background: #f8fafc; font-weight: bold;">Leave Type</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${leaveTypeDoc.name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; background: #f8fafc; font-weight: bold;">Duration</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${moment(startDate).format("DD MMM YYYY")} to ${moment(endDate).format("DD MMM YYYY")}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; background: #f8fafc; font-weight: bold;">Total Days</td>
                                <td style="padding: 10px; border: 1px solid #ddd;"><strong>${effectiveDays} Days</strong></td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; background: #f8fafc; font-weight: bold;">Reason</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${reason || "Not Provided"}</td>
                            </tr>
                        </table>
                        <p style="margin-top: 20px;">Please login to your admin portal to review and take action.</p>
                    </div>
                </div>
            `;
            // Fire & forget mail
            sendEmail(adminUser.email, `Leave Request: ${employeeUser.name}`, adminHtml).catch(e => console.error("Admin Email Error", e));
        }
    } catch (mailError) {
        console.error("Failed to send admin email:", mailError);
    }

    res.status(201).json({ success: true, message: "Leave Applied", data: leave });

  } catch (err) {
    console.error("Create Leave Error:", err); 
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 2. UPDATE LEAVE (Sends email to EMPLOYEE)
// ==========================================
const updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body; 
    const leaveId = req.params.id;

    // 🔥 Added populate to get employee email
    const leave = await Leave.findById(leaveId).populate("employeeId", "name email");
    if (!leave) return res.status(404).json({ message: "Leave not found" });

    if (leave.status === status) {
      return res.json({ success: true, message: "Status updated" });
    }

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
      const balance = await LeaveBalance.findOne({
        employeeId: leave.employeeId._id, // Now it's an object because of populate
        leaveTypeId: leave.leaveTypeId,
        year: year
      });

      if (!balance) return res.status(400).json({ success: false, message: "Leave Balance not found for this user." });

      const available = (balance.totalCredited || 0) + (balance.carryForwarded || 0) - (balance.used || 0);

      if (leaveDays > available) {
        return res.status(400).json({ 
            success: false, 
            message: `Insufficient Balance! Available: ${available}, Required: ${leaveDays}` 
        });
      }

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
            employeeId: leave.employeeId._id, 
            leaveTypeId: leave.leaveTypeId, 
            year: year 
        },
        { $inc: { used: -leaveDays } } 
      );
    }

    // Final Status Save
    leave.status = status;
    if (!leave.days) leave.days = leaveDays;
    await leave.save();

    // 🔥 SEND EMAIL TO EMPLOYEE IN BACKGROUND
    try {
        if (leave.employeeId && leave.employeeId.email) {
            const statusColor = status === "Approved" ? "#10b981" : "#ef4444"; // Green for Approved, Red for Rejected
            const empHtml = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: ${statusColor}; padding: 15px; color: #fff; text-align: center;">
                        <h2 style="margin: 0;">Leave Request ${status}</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>Dear <strong>${leave.employeeId.name}</strong>,</p>
                        <p>This is to inform you that your recent leave request has been <strong>${status.toUpperCase()}</strong> by the management.</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; background: #f8fafc; font-weight: bold; width: 35%;">Leave Type</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${leave.leaveType}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; background: #f8fafc; font-weight: bold;">Duration</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${moment(leave.startDate).format("DD MMM YYYY")} to ${moment(leave.endDate).format("DD MMM YYYY")}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; background: #f8fafc; font-weight: bold;">Total Days</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${leaveDays} Days</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; background: #f8fafc; font-weight: bold;">Final Status</td>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: ${statusColor};">${status}</td>
                            </tr>
                        </table>
                        <p style="margin-top: 20px;">If you have any questions, please contact the HR department.</p>
                    </div>
                </div>
            `;
            // Fire & forget mail
            sendEmail(leave.employeeId.email, `Leave Update: ${status}`, empHtml).catch(e => console.error("Employee Email Error", e));
        }
    } catch (mailError) {
        console.error("Failed to send employee email:", mailError);
    }

    res.json({ success: true, message: `Leave ${status} successfully`, data: leave });

  } catch (err) {
    console.error("❌ UPDATE ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


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

    res.json({ success: true, data });
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