const LeaveBalance = require("../../Modals/Leave/LeaveBalance");
const mongoose = require("mongoose");
const { processCarryForward } = require("../../Service/leaveCarryForward.service");
const LeavePolicy = require("../../Modals/Leave/LeavePolicy");
const User = require("../../Modals/User");
const LeaveType = require("../../Modals/Leave/LeaveType");
const moment = require("moment");

// ==========================================
// HELPER: Calculate & Format Balance Response
// ==========================================
const calculateLeaveBalance = async ({ companyId, employeeId, year }) => {
  const currentYear = year || new Date().getFullYear();

  // Fetch Policies to know what leaves exist & their limits
  const policies = await LeavePolicy.find({ companyId, isDeleted: false, isActive: true })
    .populate("leaveTypeId", "name daysAllowed"); 

  // Fetch actual balances
  const balances = await LeaveBalance.find({ employeeId, year: currentYear });

  const result = [];

  for (const pol of policies) {
    if (!pol.leaveTypeId) continue; // Safety check

    let bal = balances.find(
      (b) => b.leaveTypeId.toString() === pol.leaveTypeId._id.toString()
    );

    // If no balance record, assume 0
    if (!bal) {
      bal = { totalCredited: 0, used: 0, carryForwarded: 0 }; 
    }

    const totalCredited = bal.totalCredited || 0;
    const carryForwarded = bal.carryForwarded || 0;
    const used = bal.used || 0;
    
    // Yearly Limit from Leave Type
    const maxDaysAllowed = pol.leaveTypeId.daysAllowed || 0; 

    result.push({
      leaveTypeId: pol.leaveTypeId._id,
      leaveTypeName: pol.leaveTypeId.name,
      daysAllowed: maxDaysAllowed, 
      accrualType: pol.accrualType,
      accrualRate: pol.accrualRate,
      totalCredited,
      carryForwarded,
      used,
      available: parseFloat((totalCredited + carryForwarded - used).toFixed(2)), 
    });
  }

  return result;
};

// ==========================================
// HELPER: On-Demand Accrual Check (Single User)
// ==========================================
const runMonthlyAccrualCheck = async (companyId, employeeId) => {
  const currentDate = moment();

  // Fetch User
  const user = await User.findById(employeeId);
  if (!user) return;

  const policies = await LeavePolicy.find({ 
      companyId, 
      isDeleted: false, 
      isActive: true,
      accrualType: "Monthly"
  }).populate("leaveTypeId");

  for (const policy of policies) {
      if(!policy.leaveTypeId) continue;

      const maxLimit = policy.leaveTypeId.daysAllowed || 12;

      let balance = await LeaveBalance.findOne({
        employeeId,
        leaveTypeId: policy.leaveTypeId._id,
        year: currentDate.year(),
      });

      // Create if not exists
      if (!balance) {
        // Safe Start Date Logic
        let startPoint = null;
        if (user.doj) {
            const doj = moment(user.doj);
            const startOfYear = moment().startOf('year');
            startPoint = doj.isBefore(startOfYear) ? startOfYear.format("YYYY-MM") : doj.format("YYYY-MM");
        }

        balance = await LeaveBalance.create({
          companyId,
          employeeId,
          leaveTypeId: policy.leaveTypeId._id,
          year: currentDate.year(),
          totalCredited: 0,
          used: 0,
          carryForwarded: 0,
          lastAccruedMonth: startPoint, 
        });
      }

      // Determine Last Run
      let lastRun;
      if (balance.lastAccruedMonth) {
          lastRun = moment(balance.lastAccruedMonth, "YYYY-MM");
      } else if (user.doj) {
          const doj = moment(user.doj);
          const startOfYear = moment().startOf('year');
          lastRun = doj.isBefore(startOfYear) ? startOfYear : doj;
      } else {
          lastRun = moment().startOf('year');
      }

      const monthsDiff = currentDate.diff(lastRun, "months");

      if (monthsDiff > 0) {
        let newCredit = balance.totalCredited + (monthsDiff * policy.accrualRate);

        if (maxLimit && newCredit > maxLimit) {
          newCredit = maxLimit;
        }

        balance.totalCredited = newCredit;
        balance.lastAccruedMonth = currentDate.format("YYYY-MM");

        await balance.save();
      }
  }
};


// ==================================
// 1️⃣ Get My Balance (Employee View)
// ==================================
const getMyLeaveBalance = async (req, res) => {
  try {
      // Pehle check karo agar koi monthly credit pending hai
      await runMonthlyAccrualCheck(req.companyId, req.user._id);
      
      const data = await calculateLeaveBalance({ companyId: req.companyId, employeeId: req.user._id });
      res.json({ success: true, data });
  } catch (err) {
      res.status(500).json({ success: false, message: err.message });
  }
}

// ==================================
// 2️⃣ Get Employee Balance (Admin View)
// ==================================
const getLeaveBalanceByEmployeeId = async (req, res) => { 
  try {
      const data = await calculateLeaveBalance({ companyId: req.companyId, employeeId: req.params.employeeId });
      res.json({ success: true, data });
  } catch (err) {
      res.status(500).json({ success: false, message: err.message });
  }
}

// ==================================
// 3️⃣ ADMIN → MANUAL ADJUST
// ==================================
const adjustLeaveBalance = async (req, res) => {
  try {
    const { employeeId, leaveTypeId, adjustmentType, days } = req.body;

    if (!employeeId || !leaveTypeId || !days) {
      return res.status(400).json({
        success: false,
        message: "employeeId, leaveTypeId & days required",
      });
    }

    const year = new Date().getFullYear();

    let balance = await LeaveBalance.findOne({
      employeeId,
      leaveTypeId,
      year,
    });

    if (!balance) {
      balance = await LeaveBalance.create({
        companyId: req.companyId,
        employeeId,
        leaveTypeId,
        year,
        totalCredited: 0,
        used: 0,
        carryForwarded: 0,
      });
    }

    const daysValue = Number(days);

    if (adjustmentType === "add") {
      balance.totalCredited += daysValue;
    } else if (adjustmentType === "deduct") {
      // Optional: Prevent negative balance
      const currentAvailable = (balance.totalCredited + balance.carryForwarded) - balance.used;
      // if (currentAvailable - daysValue < 0) return res.status(400).json({ message: "Insufficient balance" });

      balance.totalCredited -= daysValue; 
    }

    await balance.save();

    res.json({
      success: true,
      message: "Leave balance adjusted",
      data: balance,
    });
  } catch (err) {
    console.error("adjustLeaveBalance", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================================
// 4️⃣ YEAR END CARRY FORWARD
// ==================================
const runCarryForward = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { oldYear, newYear } = req.body;

    // Check if ANY balance exists for the new year to prevent double run
    const exists = await LeaveBalance.findOne({
      companyId,
      year: newYear,
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Carry forward for ${newYear} seems to have been processed already.`,
      });
    }

    await processCarryForward(companyId, oldYear, newYear);

    res.json({
      success: true,
      message: "Carry forward processed successfully",
    });
  } catch (err) {
    console.error("runCarryForward", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getMyLeaveBalance,
  getLeaveBalanceByEmployeeId,
  adjustLeaveBalance,
  runCarryForward,
};