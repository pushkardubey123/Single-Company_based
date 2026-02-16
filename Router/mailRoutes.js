const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");

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
  
  // New Controllers
  saveDraft,
  getDrafts,
  toggleStar,
  getStarredMails,
  toggleSpam,
  getSpamMails
} = require("../Controllers/sendMailController");

// Basic Routes
router.post("/send", auth, attachCompanyId, sendMail);
router.get("/user/all", auth, attachCompanyId, getAllUsers);
router.get("/", auth, attachCompanyId, getAllMails);
router.get("/my-mails", auth, attachCompanyId, getMyMails);
router.get("/download/:filename", downloadAttachment);

// Draft Routes
router.post("/draft", auth, attachCompanyId, saveDraft);
router.get("/draft", auth, attachCompanyId, getDrafts);

// Starred Routes
router.get("/starred", auth, attachCompanyId, getStarredMails);
router.put("/star/:id", auth, attachCompanyId, toggleStar); // PUT req to toggle

// Spam Routes
router.get("/spam", auth, attachCompanyId, getSpamMails);
router.put("/spam/:id", auth, attachCompanyId, toggleSpam); // PUT req to toggle

// Trash & Delete Routes
router.get("/trash", auth, attachCompanyId, getTrashedMails);
router.put("/trash/:id", auth, attachCompanyId, moveToTrash);
router.put("/restore/:id", auth, attachCompanyId, restoreMail);
router.delete("/permanent-delete/:id", auth, attachCompanyId, deleteMailPermanently);

module.exports = router;