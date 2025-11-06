const Payroll = require("../Modals/Payroll");
const User = require("../Modals/User");

const createPayroll = async (req, res) => {
  try {
    const {
      employeeId,
      month,
      basicSalary,
      allowances = [],
      deductions = [],
      workingDays = 0,
      paidDays = 0,
    } = req.body;

    if (!employeeId || !month) {
      return res.status(400).json({
        success: false,
        message: "Employee and Month are required",
      });
    }
    let finalBasicSalary = basicSalary;
    if (!finalBasicSalary) {
      const employee = await User.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }
      finalBasicSalary = employee.basicSalary || 0;
    }

    const totalAllowances = allowances.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );
    const totalDeductions = deductions.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );
    const netSalary = finalBasicSalary + totalAllowances - totalDeductions;

    const payroll = new Payroll({
      employeeId,
      month,
      basicSalary: finalBasicSalary,
      allowances,
      deductions,
      workingDays,
      paidDays,
      netSalary,
      generatedBy: req.user.id,
    });

    const saved = await payroll.save();

    res.status(201).json({
      success: true,
      message: "Payroll created successfully",
      data: saved,
    });
  } catch (err) {
    console.error("Payroll Error:", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getAllPayrolls = async (req, res) => {
  try {
    const payrolls = await Payroll.find()
      .populate({
        path: "employeeId",
        select: "name email pan bankAccount departmentId designationId",
        populate: [
          { path: "departmentId", select: "name" },
          { path: "designationId", select: "name" },
        ],
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Payrolls fetched successfully",
      data: payrolls,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate(
      "employeeId",
      "name email"
    );

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    res.json({
      success: true,
      message: "Payroll fetched successfully",
      data: payroll,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getPayrollByEmployeeId = async (req, res) => {
  try {
    const employeeId = req.params.id;

    const payrolls = await Payroll.find({ employeeId }).populate(
      "employeeId",
      "name email phone"
    );

    res.status(200).json({
      success: true,
      message: "Payrolls fetched for employee",
      data: payrolls,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updatePayroll = async (req, res) => {
  try {
    const {
      employeeId,
      month,
      basicSalary,
      allowances = [],
      deductions = [],
      workingDays = 0,
      paidDays = 0,
    } = req.body;

    const totalAllowances = allowances.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );
    const totalDeductions = deductions.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );
    const netSalary = basicSalary + totalAllowances - totalDeductions;

    const updated = await Payroll.findByIdAndUpdate(
      req.params.id,
      {
        employeeId,
        month,
        basicSalary,
        allowances,
        deductions,
        netSalary,
        workingDays,
        paidDays,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    res.json({
      success: true,
      message: "Payroll updated successfully",
      data: updated,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const deletePayroll = async (req, res) => {
  try {
    const deleted = await Payroll.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    res.json({
      success: true,
      message: "Payroll deleted successfully",
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = {
  createPayroll,
  getAllPayrolls,
  getPayrollById,
  updatePayroll,
  deletePayroll,
  getPayrollByEmployeeId,
};
