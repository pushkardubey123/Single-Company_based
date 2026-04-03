const express = require("express");
const router = express.Router();

const { 
  register, login, getAllUsers, getUserById, updateUser, deleteUser, 
  userForgetPassword, userVerifyPassword, userResetPassword, getPendingUsers, 
  approvePendingUser, rejectPendingUser, getAllEmployeeDates, googleLogin, 
  googleRegister, googleAuthCheck, getMyProfile, updateMyProfile, getMySubscription,
  getPublicCompanies
} = require("../Controllers/UserController");

const auth = require("../Middleware/auth");
const attachCompanyId = require("../Middleware/companyMiddleware");
const checkPermission = require("../Middleware/checkPermission"); 
const checkSubscription = require("../Middleware/checkSubscription"); 

// 1. PUBLIC ROUTES (No subscription check)
router.post("/user/register", register);
router.post("/user/login", login);
router.post("/user/google-login", googleLogin);
router.post("/user/google-auth-check", googleAuthCheck);
router.post("/user/google-register", googleRegister);
router.post("/user/forgot-password", userForgetPassword);
router.post("/user/verify-otp", userVerifyPassword);
router.post("/user/reset-password", userResetPassword);

// ✅ NEW PUBLIC ROUTE FOR COMPANY DROPDOWN
router.get("/public/companies", getPublicCompanies); 

// 2. SELF SERVICE ROUTES
router.get("/user/profile", auth, attachCompanyId, checkSubscription, getMyProfile); 
router.put("/user/profile", auth, attachCompanyId, checkSubscription, updateMyProfile);

// ==========================================
// 3. STAFF / EMPLOYEE MANAGEMENT (FIXED MODULE NAMES)
// ==========================================
router.get("/user", auth, attachCompanyId, checkSubscription, checkPermission("employee_management", "view"), getAllUsers);
router.get("/employeeget/:id", auth, attachCompanyId, checkSubscription, checkPermission("employee_management", "view"), getUserById);
router.put("/employeeget/:id", auth, attachCompanyId, checkSubscription, checkPermission("employee_management", "edit"), updateUser);
router.delete("/employeedelete/:id", auth, attachCompanyId, checkSubscription, checkPermission("employee_management", "delete"), deleteUser);

// ==========================================
// 4. PENDING USERS / STAFF VERIFICATION (FIXED MODULE NAMES)
// ==========================================
router.get("/user/pending-users", auth, attachCompanyId, checkSubscription, checkPermission("staff_verification", "view"), getPendingUsers);
// Note: Changed "add" to "create" to match your permission schema (view, create, edit, delete)
router.post("/user/approve-user/:id", auth, attachCompanyId, checkSubscription, checkPermission("staff_verification", "create"), approvePendingUser);
router.delete("/pending/reject/:id", auth, attachCompanyId, checkSubscription, checkPermission("staff_verification", "delete"), rejectPendingUser);

// 5. MISC
router.get("/user/employee-dates", auth, attachCompanyId, checkSubscription, checkPermission("bday", "view"), getAllEmployeeDates);
router.get("/user/my-subscription", auth, attachCompanyId, getMySubscription);

module.exports = router;