const mongoose = require("mongoose");

const leavePolicySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    leaveTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveType",
      required: true,
    },

    // Probation / eligibility
    applicableAfterDays: {
      type: Number,
      default: 0,
    },

    // Accrual configuration
    accrualType: {
      type: String,
      enum: ["Monthly"],
      required: true,
    },

    /**
     * Monthly  => credit per month
     * Yearly   => total credit per year
     */
    accrualRate: {
      type: Number,
      required: true,
    },

    // Leave request rules
    maxPerRequest: {
      type: Number,
      default: null,
    },

    allowHalfDay: {
      type: Boolean,
      default: false,
    },

    allowBackdated: {
      type: Boolean,
      default: false,
    },

    // Approval flow
    approvalFlow: {
      type: [String], // ["Manager", "HR", "Admin"]
      default: ["Admin"],
    },

    // Policy status
    isActive: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

/**
 * One Leave Policy per LeaveType per Company
 */
leavePolicySchema.index(
  { companyId: 1, leaveTypeId: 1 },
  { unique: true }
);

module.exports = mongoose.model("LeavePolicy", leavePolicySchema);
