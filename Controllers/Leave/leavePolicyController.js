const LeavePolicy = require("../../Modals/Leave/LeavePolicy");
const LeaveType = require("../../Modals/Leave/LeaveType");
const User = require("../../Modals/User");
const LeaveBalance = require("../../Modals/Leave/LeaveBalance");
const moment = require("moment");

/**
 * GET /api/leave-policies
 * Fetch all active policies
 */
exports.getLeavePolicies = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;

    const policies = await LeavePolicy.find({
      companyId,
      isDeleted: false,
    })
      .populate("leaveTypeId", "name isPaid")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: policies,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch leave policies",
    });
  }
};

/**
 * POST /api/leave-policies
 * Logic:
 * 1. Validate Input
 * 2. Deactivate OLD Policy for this LeaveType (if exists)
 * 3. Create NEW Policy
 * 4. Sync/Initialize Balance for all employees immediately
 */
exports.createLeavePolicy = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;

    const {
      leaveTypeId,
      applicableAfterDays,
      accrualType,
      accrualRate,
      maxPerYear,
      maxPerRequest,
      allowHalfDay,
      allowBackdated,
      approvalFlow,
    } = req.body;

    // 1. Basic Validation
    if (!leaveTypeId || !accrualType || !accrualRate || !maxPerYear) {
      return res.status(400).json({
        success: false,
        message: "leaveTypeId, accrualType, accrualRate, and maxPerYear are required",
      });
    }

    // 2. Validate Leave Type Existence
    const leaveTypeDoc = await LeaveType.findOne({
      _id: leaveTypeId,
      companyId,
      isDeleted: false,
    });

    if (!leaveTypeDoc) {
      return res.status(404).json({ success: false, message: "Invalid Leave Type" });
    }

    // 3. 🔥 DEACTIVATE OLD POLICY (Soft Delete)
    // Agar pehle se koi policy active hai is type ki, to usse delete/inactive kar do
    // Taaki 'Monthly Accrual' script confuse na ho ki kaunsi policy lagani hai.
    const existingPolicy = await LeavePolicy.findOne({
      companyId,
      leaveTypeId,
      isDeleted: false,
    });

    if (existingPolicy) {
      existingPolicy.isDeleted = true;
      existingPolicy.isActive = false;
      await existingPolicy.save();
      console.log(`⚠️ Deactivated old policy for: ${leaveTypeDoc.name}`);
    }

    // 4. Create NEW Policy
    const policy = await LeavePolicy.create({
      companyId,
      leaveTypeId,
      applicableAfterDays: applicableAfterDays || 0,
      accrualType,
      accrualRate,
      maxPerYear,
      maxPerRequest,
      allowHalfDay: !!allowHalfDay,
      allowBackdated: !!allowBackdated,
      approvalFlow: approvalFlow || ["Admin"],
      isActive: true,
      isDeleted: false
    });

    // 5. 🔥 SYNC BALANCES (Background Task)
    // Nayi policy aayi hai, to sabhi employees ke liye Balance Table initialize karo
    syncNewPolicyWithEmployees(companyId, leaveTypeId, accrualType, accrualRate);

    res.status(201).json({
      success: true,
      message: "Leave policy created & applied. Old policy (if any) replaced.",
      data: policy,
    });

  } catch (err) {
    console.error("Create LeavePolicy Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create leave policy",
    });
  }
};

/**
 * PUT /api/leave-policies/:id
 * Update values of an existing policy
 */
exports.updateLeavePolicy = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;
    const { id } = req.params;

    const policy = await LeavePolicy.findOne({
      _id: id,
      companyId,
      isDeleted: false,
    });

    if (!policy) {
      return res.status(404).json({ success: false, message: "Leave policy not found" });
    }

    // Update allowable fields
    const allowedFields = [
      "applicableAfterDays", "accrualType", "accrualRate",
      "maxPerYear", "maxPerRequest", "allowHalfDay",
      "allowBackdated", "approvalFlow"
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        policy[field] = req.body[field];
      }
    });

    await policy.save();

    res.json({
      success: true,
      message: "Leave policy updated successfully",
      data: policy,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update leave policy",
    });
  }
};

/**
 * DELETE /api/leave-policies/:id
 * Soft Delete
 */
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

    res.json({
      success: true,
      message: "Leave policy deactivated successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to delete leave policy",
    });
  }
};

// ==========================================
// 🛠 HELPER FUNCTION: Sync Balances
// ==========================================
const syncNewPolicyWithEmployees = async (companyId, leaveTypeId, accrualType, accrualRate) => {
    try {
        const currentYear = new Date().getFullYear();
        
        // Find all active employees
        const employees = await User.find({ 
            companyId, 
            role: 'employee', 
            status: 'active' 
        });

        if(employees.length === 0) return;

        const balancesToInsert = [];

        for (const emp of employees) {
            // Check if balance already exists for this Leave Type & Year
            const exists = await LeaveBalance.findOne({
                employeeId: emp._id,
                leaveTypeId,
                year: currentYear
            });

            if (!exists) {
                // Calculation Logic:
                // 1. Monthly: Start with 0 (Cron job will add credit next run)
                // 2. Yearly: Give Pro-rata credit based on remaining months
                
                let credit = 0;
                let lastAccrued = null;

                if (accrualType === "Yearly") {
                    const currentMonth = new Date().getMonth(); // 0 (Jan) to 11 (Dec)
                    const remainingMonths = 12 - currentMonth;
                    
                    // Logic: Rate per month * remaining months
                    const creditPerMonth = accrualRate / 12;
                    credit = parseFloat((creditPerMonth * remainingMonths).toFixed(1));
                    
                    // Yearly credit immediately marked as done
                    lastAccrued = moment().format("YYYY-MM"); 
                } else {
                    // Monthly: Start with 0. 
                    // 'lastAccrued' null means cron job will pick it up and calculate from start of year or DOJ.
                    // If we want to start accruing from TODAY onwards only, set lastAccrued to current month.
                    lastAccrued = moment().subtract(1, 'month').format("YYYY-MM"); 
                }

                balancesToInsert.push({
                    employeeId: emp._id,
                    companyId,
                    leaveTypeId,
                    year: currentYear,
                    totalCredited: credit,
                    used: 0,
                    carryForwarded: 0,
                    lastAccruedMonth: lastAccrued
                });
            }
        }

        // Bulk Insert
        if (balancesToInsert.length > 0) {
            await LeaveBalance.insertMany(balancesToInsert);
            console.log(`✅ Synced new policy with ${balancesToInsert.length} employees.`);
        }

    } catch (error) {
        console.error("❌ Error syncing new policy:", error);
    }
};