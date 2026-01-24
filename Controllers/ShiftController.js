const Shift = require("../Modals/Shift");

const addShift = async (req, res) => {
  try {
    const { name, startTime, endTime, branchId } = req.body;
    const companyId = req.companyId;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Branch is required",
      });
    }

    const exists = await Shift.findOne({
      companyId,
      branchId,
      name,
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Shift already exists for this branch",
      });
    }

    const shift = await Shift.create({
      companyId,
      branchId,
      name,
      startTime,
      endTime,
    });

    res.status(201).json({
      success: true,
      message: "Shift created successfully",
      data: shift,
    });
  } catch (err) {
    console.error("ADD SHIFT ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};



const getAdminShifts = async (req, res) => {
  try {
    const { branchId } = req.query;
    const companyId = req.companyId;

    const filter = { companyId };
    if (branchId) filter.branchId = branchId;

    const data = await Shift.find(filter)
      .populate("branchId", "name")
      .select("name startTime endTime branchId")
      .sort({ name: 1 });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const getPublicShifts = async (req, res) => {
  try {
    const { branchId } = req.query;

    const filter = {};
    if (branchId) filter.branchId = branchId;

    const data = await Shift.find(filter)
      .select("_id name branchId");

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateShift = async (req, res) => {
  try {
    const { name, startTime, endTime } = req.body;
    const companyId = req.companyId;

    const updated = await Shift.findOneAndUpdate(
      { _id: req.params.id, companyId },
      { name, startTime, endTime },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }

    res.json({
      success: true,
      message: "Shift updated successfully",
      data: updated,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};


const deleteShift = async (req, res) => {
  try {
    const companyId = req.companyId;

    const deleted = await Shift.findOneAndDelete({
      _id: req.params.id,
      companyId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }

    res.json({
      success: true,
      message: "Shift deleted successfully",
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = { addShift, getAdminShifts,getPublicShifts, updateShift, deleteShift };
