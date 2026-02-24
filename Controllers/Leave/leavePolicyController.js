const LeavePolicy = require("../../Modals/Leave/LeavePolicy");
const LeaveType = require("../../Modals/Leave/LeaveType");
const User = require("../../Modals/User");
const LeaveBalance = require("../../Modals/Leave/LeaveBalance");
const moment = require("moment");

exports.getLeavePolicies = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;

    const policies = await LeavePolicy.find({
      companyId,
      isDeleted: false,
    })
      .populate("leaveTypeId", "name isPaid daysAllowed")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: policies });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch leave policies" });
  }
};

exports.createLeavePolicy = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;

    const {
      leaveTypeId,
      applicableAfterDays,
      accrualType,
      accrualRate,
      maxPerRequest,
      allowHalfDay,
      allowBackdated,
      approvalFlow,
    } = req.body;

    // Validation (maxPerYear removed)
    if (!leaveTypeId || !accrualType || !accrualRate) {
      return res.status(400).json({
        success: false,
        message: "leaveTypeId, accrualType, and accrualRate are required",
      });
    }

    const leaveTypeDoc = await LeaveType.findOne({ _id: leaveTypeId, companyId, isDeleted: false });
    if (!leaveTypeDoc) {
      return res.status(404).json({ success: false, message: "Invalid Leave Type" });
    }

    // Deactivate old policy
    const existingPolicy = await LeavePolicy.findOne({ companyId, leaveTypeId, isDeleted: false });
    if (existingPolicy) {
      existingPolicy.isDeleted = true;
      existingPolicy.isActive = false;
      await existingPolicy.save();
    }

    // Create NEW Policy (maxPerYear removed)
    const policy = await LeavePolicy.create({
      companyId,
      leaveTypeId,
      applicableAfterDays: applicableAfterDays || 0,
      accrualType: accrualType || "Monthly",
      accrualRate,
      maxPerRequest,
      allowHalfDay: !!allowHalfDay,
      allowBackdated: !!allowBackdated,
      approvalFlow: approvalFlow || ["Admin"],
      isActive: true,
      isDeleted: false
    });

    // Sync Balances
    syncNewPolicyWithEmployees(companyId, leaveTypeId);

    res.status(201).json({ success: true, message: "Leave policy created.", data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create leave policy" });
  }
};

exports.updateLeavePolicy = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;
    const { id } = req.params;

    const policy = await LeavePolicy.findOne({ _id: id, companyId, isDeleted: false });
    if (!policy) {
      return res.status(404).json({ success: false, message: "Leave policy not found" });
    }

    // maxPerYear is removed from allowed fields
    const allowedFields = [
      "applicableAfterDays", "accrualType", "accrualRate",
      "maxPerRequest", "allowHalfDay", "allowBackdated", "approvalFlow"
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        policy[field] = req.body[field];
      }
    });

    await policy.save();

    res.json({ success: true, message: "Leave policy updated successfully", data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update leave policy" });
  }
};

exports.deleteLeavePolicy = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;
    const { id } = req.params;

    const policy = await LeavePolicy.findOne({ _id: id, companyId });
    if (!policy) {
      return res.status(404).json({ success: false, message: "Leave policy not found" });
    }

    policy.isDeleted = true;
    policy.isActive = false;
    await policy.save();

    res.json({ success: true, message: "Leave policy deactivated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete leave policy" });
  }
};

// ==========================================
// 🛠 HELPER FUNCTION: Sync Balances
// ==========================================
const syncNewPolicyWithEmployees = async (companyId, leaveTypeId) => {
    try {
        const currentYear = new Date().getFullYear();
        const employees = await User.find({ companyId, role: 'employee', status: 'active' });

        if(employees.length === 0) return;
        const balancesToInsert = [];

        for (const emp of employees) {
            const exists = await LeaveBalance.findOne({ employeeId: emp._id, leaveTypeId, year: currentYear });

            if (!exists) {
                // Since it's strictly Monthly now, we initialize with 0 
                // and let the cron job or middleware credit it based on time.
                balancesToInsert.push({
                    employeeId: emp._id,
                    companyId,
                    leaveTypeId,
                    year: currentYear,
                    totalCredited: 0,
                    used: 0,
                    carryForwarded: 0,
                    // Start accruing from the previous month
                    lastAccruedMonth: moment().subtract(1, 'month').format("YYYY-MM")
                });
            }
        }

        if (balancesToInsert.length > 0) {
            await LeaveBalance.insertMany(balancesToInsert);
        }
    } catch (error) {
        console.error("❌ Error syncing new policy:", error);
    }
};