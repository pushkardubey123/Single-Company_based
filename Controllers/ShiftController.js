const Shift = require("../Modals/Shift");

const addShift = async (req, res) => {
  try {
    const { name, startTime, endTime } = req.body;
    const existing = await Shift.findOne({ name });
    if (existing) {
      return res.json({ success: false, message: "Shift already exists" });
    }

    const shift = new Shift({ name, startTime, endTime });
    const result = await shift.save();

    res.json({ success: true, message: "Shift created", data: result });
  } catch {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getShifts = async (req, res) => {
  try {
    const data = await Shift.find().sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const updateShift = async (req, res) => {
  try {
    const { name, startTime, endTime } = req.body;
    const updated = await Shift.findByIdAndUpdate(
      req.params.id,
      { name, startTime, endTime },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Shift not found" });
    }

    res.json({ success: true, message: "Shift updated", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteShift = async (req, res) => {
  try {
    const deleted = await Shift.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Shift not found" });
    }

    res.json({ success: true, message: "Shift deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = { addShift, getShifts, updateShift, deleteShift };
