const leaveTbl = require("../Modals/Leave");
const moment = require("moment");
const mongoose = require("mongoose"); // ✅ Required for ObjectId casting

const getLeaveReport = async (req, res) => {
  try {
    const { type, month, year } = req.query;
    let start, end;
    if (type === "Monthly") {
      if (!month) return res.status(400).json({ success: false, message: "Month is required" });
      start = moment(month, "YYYY-MM").startOf("month").toDate();
      end = moment(month, "YYYY-MM").endOf("month").toDate();
    } else if (type === "Yearly") {
      if (!year) return res.status(400).json({ success: false, message: "Year is required" });
      start = moment(year, "YYYY").startOf("year").toDate();
      end = moment(year, "YYYY").endOf("year").toDate();
    } else {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }

    // ✅ FIX 1: Ensure CompanyId is ObjectId
    const companyIdObject = new mongoose.Types.ObjectId(req.companyId);

    // ✅ FIX 2: Better Logic (Leaves jo is mahine ACTIVE thin, na ki bas start hui thin)
    // Agar leave Dec 25 ko start hui aur Jan 5 ko khatam hui, to wo Jan ki report me dikhni chahiye.
    // Logic: (LeaveStart <= MonthEnd) AND (LeaveEnd >= MonthStart)
    const filter = {
      companyId: companyIdObject,
      startDate: { $lte: end }, // Start date month end se pehle honi chahiye
      endDate: { $gte: start }  // End date month start ke baad honi chahiye
    };

    // Branch Filter (Only if not Admin)
    if (req.user.role !== 'admin' && req.user.branchId) {
      filter.branchId = req.user.branchId;
    }
    
    const leaves = await leaveTbl
      .find(filter)
      .populate("employeeId", "name email profileImage role")
      .sort({ startDate: -1 });


    res.json({
      success: true,
      data: leaves,
    });
  } catch (err) {
    console.error("❌ Error fetching leave report:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createLeave = async (req, res) => {
  try {
    console.log("USER:", req.user);
    console.log("COMPANY:", req.companyId);
    console.log("BRANCH:", req.branchId);

    const leave = await leaveTbl.create({
      employeeId: req.user._id,      
      companyId: req.companyId,
      branchId: req.branchId,
      leaveType: req.body.leaveType,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      reason: req.body.reason,
    });

    res.status(201).json({
      success: true,
      message: "Leave applied successfully",
      data: leave,
    });
  } catch (err) {
    console.error("CREATE LEAVE ERROR:", err); // 🔥 MUST
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


const getAllLeaves = async (req, res) => {
  try {
    const filter = {
  companyId: req.companyId,
};

if (req.user.role !== "admin") {
  filter.branchId = req.user.branchId;
}

const data = await leaveTbl
  .find(filter)
  .populate("employeeId", "name email");


    res.json({
      success: true,
      data,
    });
  } catch {
    res.status(500).json({ success: false });
  }
};

const getLeavesByEmployee = async (req, res) => {
  try {
    const filter = { 
      employeeId: req.params.id, 
      companyId: req.companyId 
    };

    // Agar user admin nahi hai, tabhi branch ka filter lagao
    if (req.user.role !== 'admin') {
      filter.branchId = req.user.branchId;
    }

    const leaves = await leaveTbl.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getLeaveById = async (req, res) => {
  try {
    const data = await leaveTbl
      .findOne({
        _id: req.params.id,
        companyId: req.companyId,
        branchId: req.user.branchId,
      })
      .populate("employeeId", "name email");

    if (!data) {
      return res.status(404).json({ success: false });
    }

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
const filter = {
  _id: req.params.id,
  companyId: req.companyId,
};

if (req.user.role !== "admin") {
  filter.branchId = req.user.branchId;
}

const updated = await leaveTbl.findOneAndUpdate(
  filter,
  { status: req.body.status },
  { new: true }
);


    if (!updated) {
      return res.status(404).json({ success: false });
    }

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false });
  }
};

const deleteLeave = async (req, res) => {
  try {
    const deleted = await leaveTbl.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId,
      branchId: req.user.branchId,
    });

    if (!deleted) {
      return res.status(404).json({ success: false });
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
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
