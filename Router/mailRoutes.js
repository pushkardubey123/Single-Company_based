const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");

const {
  sendMail,
  getAllMails,
  getMyMails,
  downloadAttachment,
  getTrashedMails,
  moveToTrash,
  restoreMail,
  deleteMailPermanently,
  getAllUsers,
} = require("../Controllers/sendMailController");

router.post("/send", auth, sendMail);
router.get("/user/all", auth, getAllUsers);
router.get("/", auth, getAllMails);
router.get("/my-mails", auth, getMyMails);
router.get("/download/:filename", downloadAttachment);

router.get("/trash", auth, getTrashedMails);
router.put("/trash/:id", auth, moveToTrash);
router.put("/restore/:id", auth, restoreMail);
router.delete("/permanent-delete/:id", auth, deleteMailPermanently);

module.exports = router;
