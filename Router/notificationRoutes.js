const express = require("express");
const router = express.Router();
const {
  getMyNotifications,
  markAsRead,
  sendCustomNotification,
  getAdminAlerts,
  deleteNotification,
  getAllNotification,
  getEmployeeNotifications,
  clearBellNotifications,
} = require("../Controllers/notificationController");

const verifyToken = require("../Middleware/auth");
const companyMiddleware = require("../Middleware/companyMiddleware");

router.get("/",verifyToken, companyMiddleware, getMyNotifications);
router.put("/:id/read",verifyToken, companyMiddleware, markAsRead);
router.put("/clear-bell",verifyToken, companyMiddleware, clearBellNotifications);
router.get("/employee/:employeeId",verifyToken, companyMiddleware, getEmployeeNotifications);
router.get("/admin-alerts",verifyToken, companyMiddleware, getAdminAlerts);
router.post("/send",verifyToken, companyMiddleware, sendCustomNotification);
router.get("/all",verifyToken, companyMiddleware, getAllNotification);
router.delete("/:id",verifyToken, companyMiddleware, deleteNotification);


module.exports = router;
