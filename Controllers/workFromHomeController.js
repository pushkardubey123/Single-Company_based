const WorkFromHome = require("../Modals/WFH");
const User = require("../Modals/User");

const adminAssignWFH = async (req, res) => {
  try {
    const { employeeId, fromDate, toDate, remarks, reason } = req.body;

    const user = await User.findOne({
      _id: employeeId,
      companyId: req.companyId,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Employee not found in your company",
      });
    }

    const newWFH = new WorkFromHome({
      userId: employeeId,
      companyId: req.companyId,
      branchId: user.branchId,
      fromDate,
      toDate,
      reason,
      status: "approved",
      adminRemarks: remarks || "Approved by admin",
    });

    await newWFH.save();

    res.json({
      success: true,
      message: "WFH assigned successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};


const applyWFH = async (req, res) => {
  try {
    const { fromDate, toDate, reason } = req.body;

    const newWFH = new WorkFromHome({
      userId: req.user._id,
      companyId: req.companyId,
      branchId: req.branchId,
      fromDate,
      toDate,
      reason,
    });

    await newWFH.save();

    res.json({
      success: true,
      message: "WFH request submitted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


const getMyWFH = async (req, res) => {
  try {
    const data = await WorkFromHome.find({
      userId: req.user._id,
      companyId: req.companyId,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const getAllWFH = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const { branchId } = req.query;

    const filter = {
      companyId: req.companyId,
    };

    if (branchId) filter.branchId = branchId;

    const data = await WorkFromHome.find(filter)
      .populate("userId", "name email")
      .populate("branchId", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const updateWFHStatus = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  try {
    const { status, adminRemarks } = req.body;

    const updated = await WorkFromHome.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.companyId,
      },
      { status, adminRemarks },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "WFH request not found",
      });
    }

    res.json({
      success: true,
      message: "WFH status updated",
      data: updated,
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


module.exports = {
  applyWFH,
  getMyWFH,
  getAllWFH,
  updateWFHStatus,
  adminAssignWFH,
};
