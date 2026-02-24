const Notification = require("../Modals/Notification");
const User = require("../Modals/User");
const pendingEmployee = require("../Modals/PendingUser");
const Leave = require("../Modals/Leave");
const Exit = require("../Modals/ExitRequest");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const sendEmail = require("../utils/sendEmail"); // ✅ Import Email Utility

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

/* ================= HELPER: EMAIL HTML GENERATOR ================= */
// Premium Mobile Responsive Email Template
const generateNotificationEmailHtml = (title, message, empName) => {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fe; padding: 30px 15px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        
        <div style="background-color: #4f46e5; padding: 25px 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">
            New Company Announcement
          </h2>
        </div>
        
        <div style="padding: 30px 25px; color: #334155;">
          <p style="font-size: 16px; margin-top: 0;">Dear <strong>${empName}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 25px;">You have received a new official notification from the administration.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 20px; border-radius: 4px; margin-bottom: 25px;">
            <h3 style="margin: 0 0 10px 0; font-size: 17px; color: #0f172a;">${title}</h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #475569; white-space: pre-wrap;">${message}</p>
          </div>
          
          <p style="font-size: 14px; color: #64748b; margin-bottom: 5px;">Please log in to your employee portal to view more details.</p>
        </div>
        
        <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">This is an automated message. Please do not reply directly to this email.</p>
        </div>

      </div>
    </div>
  `;
};

/* ================= SEND CUSTOM NOTIFICATION (+ EMAIL) ================= */
exports.sendCustomNotification = async (req, res) => {
  try {
    const { title, message, recipient, type } = req.body;
    const { companyId, branchId } = req;

    if (!companyId || !title || !message) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let imageUrl = "";

    if (req.files && req.files.image) {
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

      // ✅ Fetch full user details to get email and name
      const employees = await User.find(userQuery, "_id name email");

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

      // 🔥 Send Mass Emails asynchronously (Non-blocking)
      employees.forEach(emp => {
        if (emp.email) {
          const htmlContent = generateNotificationEmailHtml(title, message, emp.name);
          sendEmail(emp.email, `Alert: ${title}`, htmlContent).catch(e => console.error("Mass Email Error", e));
        }
      });

      return res.json({
        success: true,
        message: `Notification sent to ${employees.length} employees`,
      });
    }

    /* 🔔 SINGLE EMPLOYEE */
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

    // 🔥 Send Single Email asynchronously
    try {
      const emp = await User.findById(recipient, "name email");
      if (emp && emp.email) {
        const htmlContent = generateNotificationEmailHtml(title, message, emp.name);
        sendEmail(emp.email, `Alert: ${title}`, htmlContent).catch(e => console.error("Single Email Error", e));
      }
    } catch (e) {
      console.error("Failed to trigger email:", e);
    }

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