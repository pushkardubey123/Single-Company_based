const LeaveBalance = require("../Modals/Leave/LeaveBalance");
const LeavePolicy = require("../Modals/Leave/LeavePolicy");
const User = require("../Modals/User");
const mongoose = require("mongoose");
const moment = require("moment");

const applyMonthlyAccrual = async (companyId) => {
  if (!companyId) throw new Error("companyId is required");

  const currentDate = moment();
  const currentMonthKey = currentDate.format("YYYY-MM"); // e.g. "2026-02"

  // 1. Find all Active Employees
  const employees = await User.find({
    companyId,
    role: "employee",
    status: "active",
  });

  if (employees.length === 0) {
    console.log("No active employees found.");
    return;
  }

  // 2. Find Active 'Monthly' Policies (Ignore Deleted ones)
  const policies = await LeavePolicy.find({
    companyId,
    accrualType: "Monthly",
    isActive: true,
    isDeleted: false,
  }).populate("leaveTypeId");

  console.log(`Processing Accrual for ${employees.length} employees...`);

  // 3. Loop: Employee -> Policy
  for (const emp of employees) {
    for (const pol of policies) {
      if (!pol.leaveTypeId) continue;

      const leaveTypeId = pol.leaveTypeId._id;
      // Max Limit from Leave Type (e.g., 12 Casual Leaves per year)
      const maxLimit = pol.leaveTypeId.daysAllowed || 12; 
      const accrualRate = pol.accrualRate; 

      // Check existing balance
      let balance = await LeaveBalance.findOne({
        employeeId: emp._id,
        leaveTypeId,
        year: currentDate.year(),
      });

      // If no record exists, create one
      if (!balance) {
        // Calculate safe starting point
        let startPoint = null;
        if (emp.doj) {
            const doj = moment(emp.doj);
            const startOfYear = moment().startOf('year');
            // If DOJ is older than this year, start from Jan 1st
            startPoint = doj.isBefore(startOfYear) ? startOfYear.format("YYYY-MM") : doj.format("YYYY-MM");
        }

        balance = await LeaveBalance.create({
          employeeId: emp._id,
          companyId,
          leaveTypeId,
          year: currentDate.year(),
          totalCredited: 0,
          used: 0,
          carryForwarded: 0,
          lastAccruedMonth: startPoint, 
        });
      }

      // --- CALCULATE CREDIT ---
      
      // Determine the last time accrual ran
      let lastRun;
      if (balance.lastAccruedMonth) {
          lastRun = moment(balance.lastAccruedMonth, "YYYY-MM");
      } else if (emp.doj) {
          const doj = moment(emp.doj);
          const startOfYear = moment().startOf('year');
          lastRun = doj.isBefore(startOfYear) ? startOfYear : doj;
      } else {
          lastRun = moment().startOf('year');
      }

      // Calculate Month Difference
      const monthsDiff = currentDate.diff(lastRun, 'months');

      // Only apply if at least 1 month has passed
      if (monthsDiff > 0) {
        
        let creditToAdd = monthsDiff * accrualRate;
        let newTotal = balance.totalCredited + creditToAdd;

        // 🔒 Apply Yearly Cap
        if (newTotal > maxLimit) {
          newTotal = maxLimit;
        }

        // Update Database
        balance.totalCredited = newTotal;
        balance.lastAccruedMonth = currentMonthKey; // Mark this month as processed
        
        await balance.save();
        
        console.log(`✅ Credit Added: ${emp.name} -> +${creditToAdd} days (${pol.leaveTypeId.name})`);
      } else {
        // Already up to date
        // console.log(`⏳ Skipped: ${emp.name} (Up to date)`);
      }
    }
  }
  
  return true;
};

module.exports = applyMonthlyAccrual;