const sendEmail = require("../utils/sendEmail");
const MailModel = require("../Modals/Mail");
const path = require("path");
const fs = require("fs");
const userTbl = require("../Modals/User");

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
        attachments.push({
          filename: file.name,
          path: savePath,
        });
      }
    }

    const html = `
  <div style="font-family: sans-serif;">
    <p>${message}</p>
  </div>
`;

    await sendEmail(to, subject, html, attachments, req.user.name);

    await MailModel.create({
      sender: req.user.id,
      recipients: Array.isArray(to) ? to : [to],
      subject,
      message,
      attachments: attachments.map((f) => f.filename),
    });

    res.json({ success: true, message: "Email sent successfully" });
  } catch (err) {
    console.error("Mail send error:", err);
    res.status(500).json({ success: false, message: "Failed to send mail" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await userTbl.find({}, "email name role");
    res.json({ data: users });
  } catch (err) {
    console.error("Fetch all users error:", err);
    res.status(500).json({ success: false, message: "Error fetching users" });
  }
};

const moveToTrash = async (req, res) => {
  try {
    const mail = await MailModel.findById(req.params.id);
    if (!mail)
      return res
        .status(404)
        .json({ success: false, message: "Mail not found" });

    if (!mail.trashedBy.includes(req.user.id)) {
      mail.trashedBy.push(req.user.id);
      await mail.save();
    }

    res.json({ success: true, message: "Mail moved to trash" });
  } catch (err) {
    console.error("Move to trash error:", err);
    res.status(500).json({ success: false, message: "Move to trash failed" });
  }
};

const getTrashedMails = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    const mails = await MailModel.find({
      trashedBy: userId,
      permanentlyDeletedBy: { $ne: userId },
      $or: [{ sender: userId }, { recipients: { $in: [userEmail] } }],
    })
      .populate("sender", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: mails });
  } catch (err) {
    console.error("Trash fetch error:", err);
    res.status(500).json({ success: false, message: "Error fetching trash" });
  }
};

const restoreMail = async (req, res) => {
  try {
    const mail = await MailModel.findById(req.params.id);
    if (!mail)
      return res
        .status(404)
        .json({ success: false, message: "Mail not found" });

    const before = mail.trashedBy.map((id) => id.toString());
    mail.trashedBy = mail.trashedBy.filter(
      (id) => id.toString() !== req.user.id.toString()
    );

    await mail.save();

    const after = mail.trashedBy.map((id) => id.toString());

    console.log("RESTORE DEBUG:", { before, after, current: req.user.id });

    res.json({ success: true, message: "Mail restored" });
  } catch (err) {
    console.error("Restore error:", err);
    res.status(500).json({ success: false, message: "Restore failed" });
  }
};

const deleteMailPermanently = async (req, res) => {
  try {
    const mail = await MailModel.findById(req.params.id);
    if (!mail)
      return res
        .status(404)
        .json({ success: false, message: "Mail not found" });

    if (!mail.permanentlyDeletedBy.includes(req.user.id)) {
      mail.permanentlyDeletedBy.push(req.user.id);
    }

    mail.trashedBy = mail.trashedBy.filter(
      (id) => id.toString() !== req.user.id
    );

    await mail.save();

    res.json({
      success: true,
      message: "Mail permanently removed from your account",
    });
  } catch (err) {
    console.error("Permanent delete error:", err);
    res
      .status(500)
      .json({ success: false, message: "Permanent delete failed" });
  }
};

const getAllMails = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const adminId = req.user.id;

    const mails = await MailModel.find({
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

const getMyMails = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    const mails = await MailModel.find({
      trashedBy: { $ne: userId },
      permanentlyDeletedBy: { $ne: userId },
      $or: [{ sender: userId }, { recipients: { $in: [userEmail] } }],
    })
      .populate("sender", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: mails });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

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
