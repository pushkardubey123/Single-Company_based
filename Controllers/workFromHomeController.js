const WorkFromHome = require("../Modals/WFH");
const User = require("../Modals/User");

const adminAssignWFH = async (req, res) => {
  try {
    const { employeeId, fromDate, toDate, remarks, reason } = req.body;
    const user = await User.findById(employeeId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newWFH = new WorkFromHome({
      userId: employeeId,
      fromDate,
      toDate,
      status: "approved",
      reason,
      adminRemarks: remarks || "Approved by admin",
    });

    await newWFH.save();
    res.json({ success: true, message: "WFH assigned successfully." });
  } catch (error) {
    console.error("Error assigning WFH:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const applyWFH = async (req, res) => {
  try {
    const { fromDate, toDate, reason } = req.body;
    const newWFH = new WorkFromHome({
      userId: req.user.id,
      fromDate,
      toDate,
      reason,
    });
    await newWFH.save();
    res.json({ success: true, message: "WFH request submitted" });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getMyWFH = async (req, res) => {
  try {
    const data = await WorkFromHome.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getAllWFH = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  try {
    const data = await WorkFromHome.find()
      .populate("userId", "name email departmentId designationId")
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
    const updated = await WorkFromHome.findByIdAndUpdate(
      req.params.id,
      { status, adminRemarks },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true, message: "WFH status updated", data: updated });
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
