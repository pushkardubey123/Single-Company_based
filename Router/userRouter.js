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

router.post("/user/register", register);
router.post("/user/login", login);
router.get("/user", auth, getAllUsers);
router.get("/employeeget/:id", auth, getUserById);
router.put("/employeeget/:id", auth, updateUser);
router.delete("/employeedelete/:id", auth, deleteUser);
router.post("/user/forgot-password", userForgetPassword);
router.post("/user/verify-otp", userVerifyPassword);
router.post("/user/reset-password", userResetPassword);
router.get("/user/pending-users", auth, getPendingUsers);
router.post("/user/approve-user/:id", auth, approvePendingUser);
router.delete("/pending/reject/:id", auth, rejectPendingUser);
router.get("/user/employee-dates", auth, getAllEmployeeDates);

module.exports = router;
