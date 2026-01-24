const express = require("express");
const router = express.Router();

const {
  register,
  login,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  userForgetPassword,
  userVerifyPassword,
  userResetPassword,
  getPendingUsers,
  approvePendingUser,
  rejectPendingUser,
  getAllEmployeeDates,
} = require("../Controllers/UserController");

const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");
const userTbl = require("../Modals/User");

router.post("/user/register", register);
router.post("/user/login", login);

router.get("/user", auth, attachCompanyId, getAllUsers);
router.get("/employeeget/:id", auth, attachCompanyId, getUserById);
router.put("/employeeget/:id", auth, attachCompanyId, updateUser);
router.delete("/employeedelete/:id", auth, attachCompanyId, deleteUser);

router.get("/user/pending-users", auth, attachCompanyId, getPendingUsers);
router.post("/user/approve-user/:id", auth, attachCompanyId, approvePendingUser);
router.delete("/pending/reject/:id", auth, attachCompanyId, rejectPendingUser);

router.get("/user/employee-dates", auth, attachCompanyId, getAllEmployeeDates);

router.post("/user/forgot-password", userForgetPassword);
router.post("/user/verify-otp", userVerifyPassword);
router.post("/user/reset-password", userResetPassword);
router.get("/public/companies", async (req, res) => {
  try {
    const companies = await userTbl.find({ role: "admin" }).select("name");
    res.json({ success: true, data: companies });
  } catch {
    res.json({ success: false, message: "Failed to fetch companies" });
  }
});


module.exports = router;
