const LeaveBalance = require("../Modals/Leave/LeaveBalance");
const LeaveType = require("../Modals/Leave/LeaveType");

/**
 * Carry Forward Leave Balances
 * @param {ObjectId} companyId
 * @param {Number} oldYear  (e.g. 2025)
 * @param {Number} newYear  (e.g. 2026)
 */
const processCarryForward = async (companyId, oldYear, newYear) => {
  try {
    // 1️⃣ Get last year's balances
    const balances = await LeaveBalance.find({
      companyId,
      year: oldYear,
    }).populate("leaveTypeId");

    for (const bal of balances) {
      const leaveType = bal.leaveTypeId;

      if (!leaveType) continue;

      // ❌ Carry forward not allowed
      if (!leaveType.allowCarryForward) continue;

      // 2️⃣ Remaining leaves
      const remaining =
        bal.totalCredited +
        (bal.carryForwarded || 0) -
        bal.used;

      if (remaining <= 0) continue;

      // 3️⃣ Apply max carry forward limit
      const carryForwardDays = leaveType.maxCarryForwardDays
        ? Math.min(remaining, leaveType.maxCarryForwardDays)
        : remaining;

      // 4️⃣ Check if already exists (avoid duplicate run)
      const exists = await LeaveBalance.findOne({
        employeeId: bal.employeeId,
        leaveTypeId: bal.leaveTypeId._id,
        year: newYear,
      });

      if (exists) continue;

      // 5️⃣ Create new year balance
// ✅ CORRECT
await LeaveBalance.create({
  employeeId: bal.employeeId,
  companyId,
  leaveTypeId: bal.leaveTypeId._id,
  year: newYear,
  totalCredited: 0,        // 👈 NEW YEAR starts with ZERO
  carryForwarded: carryForwardDays,
  used: 0,
  lastAccruedMonth: null,
});

    }

    console.log(
      `✅ Leave carry forward processed for company ${companyId} (${oldYear} → ${newYear})`
    );
  } catch (err) {
    console.error("❌ Carry Forward Error:", err);
    throw err;
  }
};

module.exports = { processCarryForward };
