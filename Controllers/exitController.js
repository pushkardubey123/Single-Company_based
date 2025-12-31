const ExitRequest = require("../Modals/ExitRequest");

/* =========================
   EMPLOYEE → CREATE
========================= */
const createExitRequest = async (req, res) => {
  try {
    const { reason, resignationDate } = req.body;

    const exit = await ExitRequest.create({
      companyId: req.companyId,
      branchId: req.branchId || null,
      employeeId: req.user._id,
      reason,
      resignationDate,
    });

    res.json({
      success: true,
      message: "Exit request submitted",
      data: exit,
    });
  } catch (err) {
    console.error("Exit submit error:", err);
    res.status(500).json({ success: false });
  }
};

/* =========================
   EMPLOYEE → MY REQUESTS
========================= */
const getExitRequestsByEmployee = async (req, res) => {
  try {
    const data = await ExitRequest.find({
      companyId: req.companyId,
      employeeId: req.user._id,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false });
  }
};

/* =========================
   ADMIN → ALL REQUESTS
========================= */
const getAllExitRequests = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false });
    }

    const filter = {
      companyId: req.companyId,
    };

    // 🔒 Branch-based admin (future-safe)
    if (req.branchId) {
      filter.branchId = req.branchId;
    }

    const data = await ExitRequest.find(filter)
      .populate("employeeId", "name email profilePic")
      .sort({ createdAt: -1 });

    res.json({ success: true, data });
  } catch (err) {
    console.error("Exit admin fetch error:", err);
    res.status(500).json({ success: false });
  }
};

/* =========================
   ADMIN → UPDATE
========================= */
const updateExitRequestByAdmin = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false });
    }

    const updated = await ExitRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.companyId,
      },
      {
        interviewFeedback: req.body.interviewFeedback,
        clearanceStatus: req.body.clearanceStatus,
        finalSettlement: req.body.finalSettlement,
      },
      { new: true }
    );

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false });
  }
};

/* =========================
   DELETE (PENDING ONLY)
========================= */
const deleteExitRequest = async (req, res) => {
  try {
    const reqDoc = await ExitRequest.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!reqDoc || reqDoc.clearanceStatus !== "pending") {
      return res.status(400).json({ success: false });
    }

    await reqDoc.deleteOne();
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
};

module.exports = {
  createExitRequest,
  getAllExitRequests,
  getExitRequestsByEmployee,
  updateExitRequestByAdmin,
  deleteExitRequest,
};
