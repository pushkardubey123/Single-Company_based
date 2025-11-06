const Notification = require("../Modals/Notification");
const User = require("../Modals/User");
const sendNotification = require("../utils/sendNotification");
const pendingEmployee = require("../Modals/PendingUser");
const Leave = require("../Modals/Leave");
const Exit = require("../Modals/ExitRequest");
const mongoose = require("mongoose");

exports.getAdminAlerts = async (req, res) => {
  try {
    const pendingEmployees = await pendingEmployee.countDocuments();
    const pendingLeaves = await Leave.countDocuments({ status: "Pending" });
    const pendingExits = await Exit.countDocuments({
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
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch admin alerts" });
  }
};

exports.getEmployeeNotifications = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID" });
    }

    const notifications = await Notification.find({
      recipient: employeeId,
    }).sort({ createdAt: -1 });
    res.status(200).json(notifications);
  } catch (error) {
    console.error("Fetch Notifications Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getAllNotification = async (req, res) => {
  try {
    const allNotifications = await Notification.find()
      .populate("recipient", "name")
      .sort({ createdAt: -1 });
    res.status(200).json(allNotifications);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

exports.sendCustomNotification = async (req, res) => {
  try {
    const { title, message, recipient, type } = req.body;

    let imageUrl = "";

    if (req.files && req.files.image) {
      const imageFile = req.files.image;
      const fileName = `${Date.now()}_${imageFile.name}`;
      const savePath = `./uploads/notifications/${fileName}`;

      await imageFile.mv(savePath);
      imageUrl = `notifications/${fileName}`;
    }

    if (recipient === "all") {
      const allEmployees = await User.find({ role: "employee" }, "_id");

      if (!allEmployees.length) {
        return res
          .status(404)
          .json({ success: false, message: "No employees found" });
      }

      const notifications = allEmployees.map((emp) => ({
        title,
        message,
        recipient: emp._id,
        type: type || "custom",
        image: imageUrl || null,
        createdAt: new Date(),
      }));

      await Notification.insertMany(notifications);

      return res.status(200).json({
        success: true,
        message: "Notification sent to all employees",
      });
    }

    const notification = new Notification({
      title,
      message,
      recipient,
      type: type || "custom",
      image: imageUrl || null,
      createdAt: new Date(),
    });

    await notification.save();

    return res.status(200).json({
      success: true,
      message: "Notification sent",
      notification,
    });
  } catch (err) {
    console.error("Send Notification Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send notification" });
  }
};

exports.getMyNotifications = async (req, res) => {
  try {
    const notifs = await Notification.find({
      recipient: req.user.id,
      removedFromBell: false,
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: notifs });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch notifications" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ success: true, message: "Marked as read" });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update notification" });
  }
};

exports.clearBellNotifications = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id },
      { $set: { removedFromBell: true } }
    );
    res.json({ success: true, message: "Cleared from bell" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.id,
    });
    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Failed to delete notification" });
  }
};
