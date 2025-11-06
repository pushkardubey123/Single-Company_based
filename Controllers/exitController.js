const ExitRequest = require("../Modals/ExitRequest");

const createExitRequest = async (req, res) => {
  try {
    const { reason, resignationDate } = req.body;
    const employeeId = req.user.id;

    const newRequest = new ExitRequest({
      employeeId,
      reason,
      resignationDate,
    });

    await newRequest.save();
    res.json({
      success: true,
      message: "Exit request submitted",
      data: newRequest,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getAllExitRequests = async (req, res) => {
  try {
    const requests = await ExitRequest.find()
      .populate("employeeId", "name email profilePic")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch requests" });
  }
};

const getExitRequestsByEmployee = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const requests = await ExitRequest.find({ employeeId });
    res.json({ success: true, data: requests });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch" });
  }
};

const updateExitRequestByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { interviewFeedback, clearanceStatus, finalSettlement } = req.body;

    const updated = await ExitRequest.findByIdAndUpdate(
      id,
      {
        interviewFeedback,
        clearanceStatus,
        finalSettlement,
      },
      { new: true }
    );

    res.json({ success: true, message: "Exit request updated", data: updated });
  } catch {
    res.status(500).json({ success: false, message: "Update failed" });
  }
};

const deleteExitRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await ExitRequest.findById(id);
    if (!request || request.clearanceStatus !== "pending") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Only pending requests can be deleted",
        });
    }

    await ExitRequest.findByIdAndDelete(id);
    res.json({ success: true, message: "Exit request deleted" });
  } catch {
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};

module.exports = {
  createExitRequest,
  getAllExitRequests,
  getExitRequestsByEmployee,
  updateExitRequestByAdmin,
  deleteExitRequest,
};
