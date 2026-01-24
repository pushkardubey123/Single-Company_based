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
const attachCompanyId = require("../Middleware/companyMiddleware");

router.post("/send", auth, attachCompanyId, sendMail);
router.get("/user/all", auth, attachCompanyId, getAllUsers);
router.get("/", auth, attachCompanyId, getAllMails);
router.get("/my-mails", auth, attachCompanyId, getMyMails);
router.get("/trash", auth, attachCompanyId, getTrashedMails);
router.put("/trash/:id", auth, attachCompanyId, moveToTrash);
router.put("/restore/:id", auth, attachCompanyId, restoreMail);
router.delete("/permanent-delete/:id", auth, attachCompanyId, deleteMailPermanently);

router.get("/download/:filename", downloadAttachment);

module.exports = router;
