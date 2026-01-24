const sendEmail = require("../utils/sendEmail");
const MailModel = require("../Modals/Mail");
const path = require("path");
const fs = require("fs");
const userTbl = require("../Modals/User");
const mongoose = require("mongoose");

/* ================= SEND MAIL ================= */
const sendMail = async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    const uploadDir = path.join(__dirname, "..", "uploads", "mails");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const attachments = [];

    if (req.files) {
      for (let file of Object.values(req.files)) {
        const savePath = path.join(uploadDir, file.name);
        await file.mv(savePath);
        attachments.push(file.name);
      }
    }

    await sendEmail(
      to,
      subject,
      `<p>${message}</p>`,
      attachments.map((f) => ({
        filename: f,
        path: path.join(uploadDir, f),
      })),
      req.user.name
    );

    await MailModel.create({
      companyId: req.companyId,
      branchId: req.user.role === "admin" ? null : req.branchId,
      sender: req.user._id,
      recipients: Array.isArray(to) ? to : [to],
      subject,
      message,
      attachments,
      trashedBy: [],
      permanentlyDeletedBy: [],
    });

    res.json({ success: true, message: "Mail sent successfully" });
  } catch (err) {
    console.error("Mail send error:", err);
    res.status(500).json({ success: false, message: "Failed to send mail" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const companyId = req.companyId; // 👈 admin ka _id hota hai for employees

    let users = [];

    if (req.user.role === "admin") {
      // ✅ Admin → sirf employees dikhaye
      users = await userTbl.find(
        {
          companyId,
          role: "employee",
        },
        "name email role"
      );
    } else {
      // ✅ Employee → admin + same branch employees

      users = await userTbl.find(
        {
          $or: [
            { _id: companyId }, // 🔥 THIS IS THE KEY (ADMIN)
            {
              companyId,
              branchId: req.branchId,
              role: "employee",
            },
          ],
        },
        "name email role"
      );
    }

    // ✅ khud ko list se hata do
    users = users.filter(
      (u) => u._id.toString() !== loggedInUserId.toString()
    );

    res.json({ success: true, data: users });
  } catch (err) {
    console.error("getAllUsers error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
    });
  }
};





/* ================= MOVE TO TRASH ================= */
const moveToTrash = async (req, res) => {
  try {
    const userId = req.user._id;

    const mail = await MailModel.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!mail)
      return res.status(404).json({ success: false, message: "Mail not found" });

    if (!mail.trashedBy.some(id => id?.toString() === userId.toString())) {
      mail.trashedBy.push(userId);
      await mail.save();
    }

    res.json({ success: true, message: "Mail moved to trash" });
  } catch (err) {
    console.error("Move to trash error:", err);
    res.status(500).json({ success: false, message: "Move to trash failed" });
  }
};

/* ================= GET TRASH ================= */
const getTrashedMails = async (req, res) => {
  try {
    const userId = req.user._id;
    const userEmail = req.user.email;

    const filter = {
      companyId: req.companyId,
      trashedBy: userId,
      permanentlyDeletedBy: { $ne: userId },
    };

    if (req.user.role !== "admin") {
      filter.$or = [
        { sender: userId },
        { recipients: { $in: [userEmail] } },
      ];
    }

    const mails = await MailModel.find(filter)
      .populate("sender", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: mails });
  } catch (err) {
    console.error("Trash fetch error:", err);
    res.status(500).json({ success: false, message: "Error fetching trash" });
  }
};

/* ================= RESTORE ================= */
const restoreMail = async (req, res) => {
  try {
    const userId = req.user._id;

    const mail = await MailModel.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!mail)
      return res.status(404).json({ success: false, message: "Mail not found" });

    mail.trashedBy = mail.trashedBy.filter(
      (id) => id && id.toString() !== userId.toString()
    );

    await mail.save();
    res.json({ success: true, message: "Mail restored" });
  } catch (err) {
    console.error("Restore error:", err);
    res.status(500).json({ success: false, message: "Restore failed" });
  }
};

/* ================= PERMANENT DELETE ================= */
const deleteMailPermanently = async (req, res) => {
  try {
    const userId = req.user._id;

    const mail = await MailModel.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!mail)
      return res.status(404).json({ success: false, message: "Mail not found" });

    if (!mail.permanentlyDeletedBy.some(id => id?.toString() === userId.toString())) {
      mail.permanentlyDeletedBy.push(userId);
    }

    mail.trashedBy = mail.trashedBy.filter(
      (id) => id && id.toString() !== userId.toString()
    );

    await mail.save();

    res.json({
      success: true,
      message: "Mail permanently deleted",
    });
  } catch (err) {
    console.error("Permanent delete error:", err);
    res.status(500).json({ success: false, message: "Permanent delete failed" });
  }
};

/* ================= ADMIN INBOX ================= */
const getAllMails = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const adminId = req.user._id;

    const mails = await MailModel.find({
      companyId: req.companyId,
      trashedBy: { $ne: adminId },
      permanentlyDeletedBy: { $ne: adminId },
    })
      .populate("sender", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: mails });
  } catch (err) {
    console.error("Admin inbox error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ================= MY MAILS (INBOX + SENT) ================= */
const getMyMails = async (req, res) => {
  try {
    const userId = req.user._id;

    const filter = {
      companyId: req.companyId,
      trashedBy: { $ne: userId },
      permanentlyDeletedBy: { $ne: userId },
      $or: [
        { sender: userId },
        { recipients: { $in: [req.user.email] } },
      ],
    };

    const mails = await MailModel.find(filter)
      .populate("sender", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: mails });
  } catch {
    res.status(500).json({ success: false });
  }
};

/* ================= DOWNLOAD ================= */
const downloadAttachment = (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "..", "uploads", "mails", filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "File not found" });
  }

  res.download(filePath, filename);
};

module.exports = {
  sendMail,
  getAllMails,
  getMyMails,
  downloadAttachment,
  deleteMailPermanently,
  getTrashedMails,
  moveToTrash,
  restoreMail,
  getAllUsers,
};
