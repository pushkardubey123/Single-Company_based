const leaveTbl = require("../Modals/Leave");
const moment = require("moment");

const getLeaveReport = async (req, res) => {
  try {
    const { type, month, year } = req.query;

    let start, end;
    if (type === "Monthly") {
      if (!month) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Month is required for monthly report",
          });
      }
      start = moment(month, "YYYY-MM").startOf("month").toDate();
      end = moment(month, "YYYY-MM").endOf("month").toDate();
    } else if (type === "Yearly") {
      if (!year) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Year is required for yearly report",
          });
      }
      start = moment(year, "YYYY").startOf("year").toDate();
      end = moment(year, "YYYY").endOf("year").toDate();
    } else {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid type. Must be Monthly or Yearly",
        });
    }

    const leaves = await leaveTbl
      .find({ startDate: { $gte: start, $lte: end } })
      .populate("employeeId", "name email");

    res.json({
      success: true,
      data: leaves,
    });
  } catch (err) {
    console.error("Error fetching leave report:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getLeaveReport,
};

const createLeave = async (req, res) => {
  try {
    const leave = new leaveTbl(req.body);
    const result = await leave.save();

    if (result) {
      res.json({
        success: true,
        error: false,
        message: "Leave applied successfully",
        code: 201,
        data: result,
      });
    } else {
      res.json({
        success: false,
        error: true,
        message: "Leave application failed",
        code: 400,
      });
    }
  } catch {
    s.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

const getAllLeaves = async (req, res) => {
  try {
    const data = await leaveTbl.find().populate("employeeId", "name email");
    res.json({
      success: true,
      error: false,
      message: "Leaves fetched successfully",
      code: 200,
      data,
    });
  } catch {
    res.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

const getLeavesByEmployee = async (req, res) => {
  try {
    const employeeId = req.params.id;

    const leaves = await leaveTbl.find({ employeeId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      error: false,
      message: "Employee leaves fetched successfully",
      code: 200,
      data: leaves,
    });
  } catch {
    res.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

const getLeaveById = async (req, res) => {
  try {
    const data = await leaveTbl
      .findById(req.params.id)
      .populate("employeeId", "name email");

    if (!data) {
      return res.json({
        success: false,
        error: true,
        message: "Leave not found",
        code: 404,
      });
    }

    res.json({
      success: true,
      error: false,
      message: "Leave fetched successfully",
      code: 200,
      data,
    });
  } catch {
    res.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await leaveTbl.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updated) {
      return res.json({
        success: false,
        error: true,
        message: "Leave not found",
        code: 404,
      });
    }

    res.json({
      success: true,
      error: false,
      message: "Leave status updated successfully",
      code: 200,
      data: updated,
    });
  } catch {
    s.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

const deleteLeave = async (req, res) => {
  try {
    const deleted = await leaveTbl.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.json({
        success: false,
        error: true,
        message: "Leave not found",
        code: 404,
      });
    }

    res.json({
      success: true,
      error: false,
      message: "Leave deleted successfully",
      code: 200,
    });
  } catch {
    s.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
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
