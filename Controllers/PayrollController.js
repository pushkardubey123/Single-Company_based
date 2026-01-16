const Payroll = require("../Modals/Payroll");
const User = require("../Modals/User");

/**
 * ===============================
 * CREATE PAYROLL (Admin / HR)
 * ===============================
 */
exports.createPayroll = async (req, res) => {
  try {
    const {
      employeeId,
      month,
      basicSalary, // ✅ now defined
      allowances = {},
      deductions = {},
      workingDays,
      paidDays,
    } = req.body;

    // 🔐 Employee se company + branch + basicSalary AUTO
    const employee = await User.findById(employeeId).select(
      "companyId branchId basicSalary"
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // ✅ final basic salary priority:
    // 1. frontend value
    // 2. employee profile
    let finalBasicSalary = Number(basicSalary);
    if (!finalBasicSalary) {
      finalBasicSalary = Number(employee.basicSalary || 0);
    }

    // ---- Salary calculation ----
    const totalAllowances = Object.values(allowances).reduce(
      (a, b) => a + Number(b || 0),
      0
    );

    const totalDeductions = Object.values(deductions).reduce(
      (a, b) => a + Number(b || 0),
      0
    );

    const paidDaysNum = Number(paidDays || 0);

    let monthDays = 30;
    if (month && month.includes("-")) {
      try {
        const [yStr, mStr] = month.split("-");
        monthDays = new Date(Number(yStr), Number(mStr), 0).getDate();
      } catch {}
    }

    const proratedBasic =
      paidDaysNum === 0
        ? 0
        : (finalBasicSalary / monthDays) * paidDaysNum;

    const netSalary =
      Math.round(
        (proratedBasic + totalAllowances - totalDeductions + Number.EPSILON) *
          100
      ) / 100;

    const payroll = await Payroll.create({
      employeeId,
      companyId: employee.companyId,
      branchId: employee.branchId,
      month,
      basicSalary: finalBasicSalary, // ✅ SAVE correct value
      allowances,
      deductions,
      workingDays,
      paidDays,
      netSalary,
      generatedBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Payroll generated successfully",
      data: payroll,
    });
  } catch (error) {
    console.error("Create Payroll Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create payroll",
      error: error.message,
    });
  }
};


/**
 * ===============================
 * GET ALL PAYROLLS (Admin / HR)
 * company + optional branch filter
 * ===============================
 */
exports.getAllPayrolls = async (req, res) => {
  try {
    const filter = {
      companyId: req.companyId, // 🔐 attendance style
      ...(req.query.branchId && { branchId: req.query.branchId }),
    };

    const payrolls = await Payroll.find(filter)
  .populate({
    path: "employeeId",
    select: "name employeeCode departmentId",
    populate: {
      path: "departmentId",
      select: "name",
    },
  })
  .populate("branchId", "name")
  .sort({ createdAt: -1 });


    return res.status(200).json({
      success: true,
      data: payrolls,
    });
  } catch (error) {
    console.error("Get Payrolls Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payrolls",
      error: error.message,
    });
  }
};

/**
 * ===============================
 * GET SINGLE PAYROLL (Admin / HR)
 * ===============================
 */
exports.getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      companyId: req.companyId, // 🔐 security
    })
      .populate({
  path: "employeeId",
  select: "name  departmentId",
  populate: {
    path: "departmentId",
    select: "name",
  },
})

      .populate("branchId", "name");

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: payroll,
    });
  } catch (error) {
    console.error("Get Payroll Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payroll",
      error: error.message,
    });
  }
};

exports.getPayrollByEmployeeId = async (req, res) => {
  try {
    const { id: employeeId } = req.params;
    const { month } = req.query;

    const filter = {
      employeeId,
      companyId: req.companyId, // 🔐 company scope
    };

    if (month) {
      filter.month = month;
    }

    const payrolls = await Payroll.find(filter)
      .populate({
  path: "employeeId",
  select: "name employeeCode departmentId",
  populate: {
    path: "departmentId",
    select: "name",
  },
})
      .populate("branchId", "name")
      .sort({ month: -1 });

    return res.status(200).json({
      success: true,
      data: payrolls,
    });
  } catch (error) {
    console.error("Get Payroll By Employee Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee payrolls",
      error: error.message,
    });
  }
};

exports.getMyPayrolls = async (req, res) => {
  try {
   const payrolls = await Payroll.find({
  employeeId: req.user._id,
  companyId: req.companyId,
})
.populate({
  path: "employeeId",
  select: "name departmentId designationId pan bankAccount",
  populate: [
    { path: "departmentId", select: "name" },
    { path: "designationId", select: "name" },
  ],
});


    return res.status(200).json({
      success: true,
      data: payrolls,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch my payrolls",
    });
  }
};


exports.updatePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    const {
      allowances = payroll.allowances,
      deductions = payroll.deductions,
      workingDays = payroll.workingDays,
      paidDays = payroll.paidDays,
    } = req.body;

    const totalAllowances = Object.values(allowances).reduce(
      (a, b) => a + Number(b || 0),
      0
    );
    const totalDeductions = Object.values(deductions).reduce(
      (a, b) => a + Number(b || 0),
      0
    );

    payroll.allowances = allowances;
    payroll.deductions = deductions;
    payroll.workingDays = workingDays;
    payroll.paidDays = paidDays;
    payroll.netSalary =
      payroll.basicSalary + totalAllowances - totalDeductions;

    await payroll.save();

    return res.status(200).json({
      success: true,
      message: "Payroll updated successfully",
      data: payroll,
    });
  } catch (error) {
    console.error("Update Payroll Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update payroll",
      error: error.message,
    });
  }
};

/**
 * ===============================
 * DELETE PAYROLL (Admin / HR)
 * ===============================
 */
exports.deletePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payroll deleted successfully",
    });
  } catch (error) {
    console.error("Delete Payroll Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete payroll",
      error: error.message,
    });
  }
};


