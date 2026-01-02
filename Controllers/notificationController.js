const Notification = require("../Modals/Notification");
const User = require("../Modals/User");
const pendingEmployee = require("../Modals/PendingUser");
const Leave = require("../Modals/Leave");
const Exit = require("../Modals/ExitRequest");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

/* ================= ADMIN ALERTS ================= */
exports.getAdminAlerts = async (req, res) => {
  try {
    const { companyId, branchId } = req;

    const baseQuery = { companyId };
    if (branchId) baseQuery.branchId = branchId;

    const pendingEmployees = await pendingEmployee.countDocuments(baseQuery);

    const pendingLeaves = await Leave.countDocuments({
      ...baseQuery,
      status: "Pending",
    });

    const pendingExits = await Exit.countDocuments({
      ...baseQuery,
      clearanceStatus: "pending",
    });

    res.json({
      success: true,
      data: [
        { title: "Pending Employee Approvals", count: pendingEmployees },
        { title: "Pending Leave Requests", count: pendingLeaves },
        { title: "Pending Exit Requests", count: pendingExits },
      ],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch admin alerts" });
  }
};

/* ================= EMPLOYEE PAGE ================= */
exports.getEmployeeNotifications = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { companyId } = req;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID" });
    }

    const notifications = await Notification.find({
      companyId,
      recipient: employeeId,
    }).sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch {
    res.status(500).json({ message: "Server Error" });
  }
};


/* ================= ADMIN ALL ================= */
exports.getAllNotification = async (req, res) => {
  try {
    const { companyId, branchId } = req;

    const query = { companyId };
    if (branchId) query.branchId = branchId;

    const allNotifications = await Notification.find(query)
      .populate("recipient", "name")
      .sort({ createdAt: -1 });

    res.status(200).json(allNotifications);
  } catch {
    res.status(500).json({ message: "Server Error" });
  }
};

/* ================= SEND CUSTOM ================= */
exports.sendCustomNotification = async (req, res) => {
  try {
    const { title, message, recipient, type } = req.body;
    const { companyId, branchId } = req;

    if (!companyId || !title || !message) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let imageUrl = "";

if (req.files && req.files.image) {
  // If single file, it can be object; if multiple, it can be array
  const imageFile = Array.isArray(req.files.image)
    ? req.files.image[0]
    : req.files.image;

  const uploadDir = path.join(__dirname, "..", "uploads", "notifications");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const fileName = `${Date.now()}_${imageFile.name.replace(/\s/g, "_")}`;
  await imageFile.mv(path.join(uploadDir, fileName));
  imageUrl = `notifications/${fileName}`;
}


    /* 🔔 ALL EMPLOYEES */
    if (recipient === "all") {
      const userQuery = { companyId, role: "employee" };
      if (branchId) userQuery.branchId = branchId;

      const employees = await User.find(userQuery, "_id");

      const notifications = employees.map((emp) => ({
        companyId,
        branchId: branchId || undefined,
        title,
        message,
        recipient: emp._id,
        type: type || "custom",
        image: imageUrl || undefined,
      }));

      await Notification.insertMany(notifications);

      return res.json({
        success: true,
        message: `Notification sent to ${employees.length} employees`,
      });
    }

    /* 🔔 SINGLE */
    if (!mongoose.Types.ObjectId.isValid(recipient)) {
      return res.status(400).json({ message: "Invalid recipient" });
    }

    const notification = await Notification.create({
      companyId,
      branchId: branchId || undefined,
      title,
      message,
      recipient,
      type: type || "custom",
      image: imageUrl || undefined,
    });

    res.json({ success: true, notification });
  } catch (err) {
    console.error("Send notification error:", err);
    res.status(500).json({ success: false, message: "Failed to send notification" });
  }
};

/* ================= BELL ================= */
exports.getMyNotifications = async (req, res) => {
  try {
    const { companyId } = req;

    const notifs = await Notification.find({
      companyId,
      recipient: req.user._id,
      removedFromBell: false,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: notifs });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
};


/* ================= READ ================= */
exports.markAsRead = async (req, res) => {
  await Notification.findOneAndUpdate(
    {
      _id: req.params.id,
      companyId: req.companyId,
      recipient: req.user._id,
    },
    { read: true }
  );

  res.json({ success: true });
};

/* ================= CLEAR BELL ================= */
exports.clearBellNotifications = async (req, res) => {
  await Notification.updateMany(
    {
      companyId: req.companyId,
      recipient: req.user._id,
    },
    { removedFromBell: true }
  );

  res.json({ success: true });
};

/* ================= DELETE ================= */
exports.deleteNotification = async (req, res) => {
  await Notification.findOneAndDelete({
    _id: req.params.id,
    companyId: req.companyId,
    recipient: req.user._id,
  });

  res.json({ success: true });
};
