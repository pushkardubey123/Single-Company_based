const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const userTbl = require("../Modals/User");
const pendingTbl = require("../Modals/PendingUser");
const sendOTP = require("../utils/sendOtp");
const LeaveBalance = require("../Modals/Leave/LeaveBalance");
const LeavePolicy = require("../Modals/Leave/LeavePolicy");
const moment = require("moment");

const initializeLeaveBalance = async (companyId, employeeId) => {
  const currentYear = new Date().getFullYear();
  
  // 1. Employee ki details lao (DOJ chahiye)
  const employee = await userTbl.findById(employeeId);
  if (!employee) return;

  const doj = moment(employee.doj); 

  const policies = await LeavePolicy.find({
    companyId,
    isDeleted: false,
    isActive: true,
  });

  for (const policy of policies) {
    const exists = await LeaveBalance.findOne({
      employeeId,
      leaveTypeId: policy.leaveTypeId,
      year: currentYear,
    });

    if (!exists) {
      let initialCredit = 0;

      // 🔥 LOGIC: Pro-rata Calculation for YEARLY Policies
      if (policy.accrualType === "Yearly") {
        
        // Agar banda issi saal join hua hai
        if (doj.year() === currentYear) {
          // Total mahine jo bache hain (Join month se Dec tak)
          // Example: Joined in Oct (Month 9). Remaining = 12 - 9 = 3 months.
          const joinedMonth = doj.month(); // 0 = Jan, 11 = Dec
          const remainingMonths = 12 - joinedMonth;
          
          // Formula: (TotalAllowed / 12) * RemainingMonths
          const perMonthRate = policy.accrualRate / 12; // e.g. 12/12 = 1 per month
          initialCredit = Math.round(perMonthRate * remainingMonths);
          
        } else {
          // Agar banda purana hai (pichle saal ka), to Pura Credit do
          initialCredit = policy.accrualRate; 
        }
      } 
      
      // 🔥 LOGIC: Monthly Policies start with 0 (Accrual script baad me add karegi)
      else if (policy.accrualType === "Monthly") {
        initialCredit = 0; 
      }

      // Create Balance Record
      await LeaveBalance.create({
        employeeId,
        companyId,
        leaveTypeId: policy.leaveTypeId,
        year: currentYear,
        totalCredited: initialCredit, // ✅ Calculated Value
        used: 0,
        carryForwarded: 0,
        // Monthly walo ke liye lastAccruedMonth null rakho taaki cron job pick kar sake
        lastAccruedMonth: policy.accrualType === "Monthly" ? null : moment().format("YYYY-MM") 
      });
      
      console.log(`Initialized ${policy.accrualType} leave for ${employee.name}: ${initialCredit} days`);
    }
  }
};





/* ================= REGISTER (Direct by Admin) ================= */
const register = async (req, res) => {
  try {
    const {
      name, email, password, phone, gender, dob, address,
      departmentId, designationId, shiftId, doj, emergencyContact,
      pan, bankAccount, branchId, basicSalary,
    } = req.body;

    const finalCompanyId = req.user && req.user.role === "admin"
        ? req.user.companyId
        : req.body.companyId;

    if (!finalCompanyId) return res.status(400).json({ success: false, message: "Company required" });
    if (!branchId) return res.status(400).json({ success: false, message: "Branch required" });

    const emailExists = (await userTbl.findOne({ email })) || (await pendingTbl.findOne({ email }));
    if (emailExists) return res.status(400).json({ success: false, message: "Email already exists" });

    let profilePic = null;
    if (req.files?.profilePic) {
      const img = req.files.profilePic;
      const uploadPath = "uploads/profiles";
      if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
      const filename = `${Date.now()}_${img.name}`;
      await img.mv(path.join(uploadPath, filename));
      profilePic = `profiles/${filename}`;
    }

    /* ================= ADMIN ADDING EMPLOYEE ================= */
    if (req.user && req.user.role === "admin") {
      const passwordHash = await bcrypt.hash(password, 10);

      const user = new userTbl({
        name, email, phone, gender, dob, address,
        departmentId, designationId, shiftId, doj,
        emergencyContact: emergencyContact ? JSON.parse(emergencyContact) : null,
        profilePic, pan, bankAccount, branchId,
        companyId: finalCompanyId,
        passwordHash,
        role: "employee",
        basicSalary: basicSalary || 0,
      });

      await user.save();

      // ✅ CALL HELPER FUNCTION HERE
      await initializeLeaveBalance(user._id, finalCompanyId);

      return res.status(201).json({
        success: true,
        message: "Employee added successfully and Leaves Assigned",
      });
    }

    /* ================= PUBLIC REGISTRATION (Pending) ================= */
    const pendingUser = new pendingTbl({
      name, email, password, phone, gender, dob, address,
      departmentId, designationId, shiftId, doj,
      emergencyContact: emergencyContact ? JSON.parse(emergencyContact) : null,
      profilePic, pan, bankAccount, branchId,
      companyId: finalCompanyId,
    });

    await pendingUser.save();

    res.status(201).json({
      success: true,
      message: "Registration pending admin approval",
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* ================= APPROVE PENDING USER ================= */
const approvePendingUser = async (req, res) => {
  try {
    const { basicSalary } = req.body;

    if (!basicSalary) return res.status(400).json({ success: false, message: "Basic salary is required" });

    const pendingUser = await pendingTbl.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!pendingUser) return res.status(404).json({ success: false, message: "User not found" });

    // ✅ FIX: Hash the password ONLY if it exists (Google users won't have it)
    let hashedPassword = undefined;
    if (pendingUser.password) {
      hashedPassword = await bcrypt.hash(pendingUser.password, 10);
    }

    const user = new userTbl({
      ...pendingUser.toObject(),
      passwordHash: hashedPassword, 
      role: "employee",
      companyId: req.companyId,
      basicSalary,
    });

    await user.save();
    
    // ✅ CALL HELPER FUNCTION HERE TOO
    await initializeLeaveBalance(user._id, req.companyId);

    await pendingTbl.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "User approved and Leaves Assigned" });
  } catch (err) {
    console.error("Approve Error:", err); // Ye console.log error details dekhne me madad karega
    res.status(500).json({ success: false, message: "Approval failed" });
  }
};

// ... (Rest of the controller remains exactly the same: login, getAllUsers, etc.)
// ... Just make sure to keep the imports and the new helper function at the top.

/* ================= LOGIN ================= */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userTbl.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        companyId: user.role === "admin" ? user._id : user.companyId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
  success: true,
  token,
  data: {
    id: user._id,        // ✅ explicit id
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    profilePic: user.profilePic
  },
});
;
  } catch {
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

/* ================= GET ALL USERS ================= */
const getAllUsers = async (req, res) => {
  try {
    const { branchId } = req.query;

    const filter = {
      role: "employee",
      companyId: req.companyId,
    };

    if (branchId) filter.branchId = branchId; // ✅ NEW

    const users = await userTbl
      .find(filter)
      .select("-passwordHash")
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .populate("shiftId", "name")
      .populate("branchId", "name");

    res.json({ success: true, data: users });
  } catch {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* ================= GET USER BY ID ================= */
const getUserById = async (req, res) => {
  try {
    const user = await userTbl
      .findOne({
        _id: req.params.id,
        companyId: req.companyId,
      })
      .select("-passwordHash")
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .populate("shiftId", "name")
      .populate("branchId", "name");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* ================= UPDATE USER ================= */
const updateUser = async (req, res) => {
  try {
    const emp = await userTbl.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!emp) {
      return res.status(404).json({ message: "User not found" });
    }

    let profilePic = emp.profilePic;

    if (req.files?.profilePic) {
      const img = req.files.profilePic;
      const uploadPath = "uploads/profiles";

      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      if (profilePic) {
        const oldImg = path.join("uploads", profilePic);
        if (fs.existsSync(oldImg)) fs.unlinkSync(oldImg);
      }

      const filename = `${Date.now()}_${img.name}`;
      await img.mv(path.join(uploadPath, filename));
      profilePic = `profiles/${filename}`;
    }

    await userTbl.findByIdAndUpdate(req.params.id, {
      ...req.body,
      profilePic,
    });

    res.json({ success: true, message: "User updated successfully" });
  } catch {
    res.status(500).json({ success: false, message: "Update failed" });
  }
};

/* ================= DELETE USER ================= */
const deleteUser = async (req, res) => {
  try {
    const user = await userTbl.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.profilePic) {
      const imgPath = path.join("uploads", user.profilePic);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await userTbl.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Deleted successfully" });
  } catch {
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};

/* ================= GET PENDING USERS ================= */
const getPendingUsers = async (req, res) => {
  try {
    const { branchId } = req.query;

    const filter = { companyId: req.companyId };
    if (branchId) filter.branchId = branchId;

    const users = await pendingTbl
      .find(filter)
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .populate("shiftId", "name")
      .populate("branchId", "name");

    res.json({ success: true, data: users });
  } catch {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/* ================= REJECT PENDING USER ================= */
const rejectPendingUser = async (req, res) => {
  try {
    await pendingTbl.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId,
    });

    res.json({ success: true, message: "User rejected" });
  } catch {
    res.status(500).json({ success: false, message: "Reject failed" });
  }
};

/* ================= BIRTHDAYS & ANNIVERSARIES ================= */
const getBirthdaysAndAnniversaries = async (req, res) => {
  try {
    const users = await userTbl.find({
      role: "employee",
      companyId: req.companyId,
      status: "active",
    });

    const today = new Date();
    const md = `${today.getMonth() + 1}-${today.getDate()}`;

    const birthdays = [];
    const anniversaries = [];

    users.forEach((u) => {
      if (u.dob && `${u.dob.getMonth() + 1}-${u.dob.getDate()}` === md)
        birthdays.push(u);
      if (u.doj && `${u.doj.getMonth() + 1}-${u.doj.getDate()}` === md)
        anniversaries.push(u);
    });

    res.json({ success: true, data: { birthdays, anniversaries } });
  } catch {
    res.status(500).json({ success: false, message: "Error fetching dates" });
  }
};

/* ================= ALL EMPLOYEE DATES ================= */
const getAllEmployeeDates = async (req, res) => {
  try {
    const data = await userTbl
      .find(
        { role: "employee", companyId: req.companyId },
        "name dob doj branchId"
      )
      .populate("branchId", "name"); // 👈 branch ka naam

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Fetch failed",
      error: error.message,
    });
  }
};


/* ================= FORGOT / VERIFY / RESET PASSWORD ================= */
const userForgetPassword = async (req, res) => {
  const { email } = req.body;

  const user = await userTbl.findOne({ email });
  if (!user)
    return res.status(404).json({ success: false, message: "Email not found" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.otp = otp;
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  await user.save();
  await sendOTP(email, otp);

  res.json({ success: true, message: "OTP sent" });
};

const userVerifyPassword = async (req, res) => {
  const { email, otp } = req.body;
  const user = await userTbl.findOne({ email });

  if (!user || user.otp !== otp || user.otpExpires < new Date()) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  res.json({ success: true, message: "OTP verified" });
};

const userResetPassword = async (req, res) => {
  const { email, newPassword, otp } = req.body;
  const user = await userTbl.findOne({ email });

  if (!user || user.otp !== otp || user.otpExpires < new Date()) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  res.json({ success: true, message: "Password reset successful" });
};

const googleLogin = async (req, res) => {
  try {
    const { credential, role } = req.body;

    // 1. Verify Google Token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub, picture } = payload;

    // 2. Check if user exists
    let user = await userTbl.findOne({ email });

    if (user) {
      // User exists - Log them in
      const token = jwt.sign(
        {
          id: user._id,
          role: user.role,
          companyId: user.role === "admin" ? user._id : user.companyId,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.json({
        success: true,
        token,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          profilePic: user.profilePic,
        },
      });
    } else {
      // 3. User does NOT exist
      if (role === "Admin") {
        // Create new Admin User automatically
        const newUser = new userTbl({
          name,
          email,
          role: "admin",
          authProvider: "google",
          googleId: sub,
          profilePic: picture,
          status: "active",
          // Password hash is not needed for Google Auth
        });

        // For Admin, companyId is usually their own ID
        newUser.companyId = newUser._id; 
        
        await newUser.save();

        const token = jwt.sign(
          { id: newUser._id, role: "admin", companyId: newUser._id },
          process.env.JWT_SECRET,
          { expiresIn: "1d" }
        );

        return res.status(201).json({
          success: true,
          message: "Admin registered via Google",
          token,
          data: {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: "admin",
            companyId: newUser._id,
            profilePic: newUser.profilePic,
          },
        });
      } else {
        // If role is Employee, deny access (Employees must be added by Admin first)
        return res.status(403).json({
          success: false,
          message: "Employees must be registered by the Company Admin first.",
        });
      }
    }
  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(500).json({ success: false, message: "Google Authentication failed" });
  }
};

/* ================= GOOGLE AUTH CHECK & LOGIN ================= */
const googleAuthCheck = async (req, res) => {
  try {
    const { credential } = req.body;

    // 1. Verify Token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub, picture } = payload;

    // 2. Check Active User Table
    let user = await userTbl.findOne({ email });

    if (user) {
      // --- SCENARIO A: Existing User (Direct Login) ---
      const token = jwt.sign(
        {
          id: user._id,
          role: user.role,
          companyId: user.role === "admin" ? user._id : user.companyId,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.json({
        success: true,
        mode: "LOGIN",
        token,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          profilePic: user.profilePic,
        },
      });
    }

    // 3. Check Pending Table (If Employee waiting for approval)
    let pending = await pendingTbl.findOne({ email });
    if (pending) {
      return res.status(403).json({
        success: false,
        message: "Your account is awaiting Admin approval.",
      });
    }

    // --- SCENARIO B: New User (Send Data to Frontend for Modal) ---
    return res.json({
      success: true,
      mode: "REGISTER",
      googleData: {
        email,
        name,
        googleId: sub,
        profilePic: picture,
      },
    });

  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ success: false, message: "Google Authentication failed" });
  }
};

/* ================= GOOGLE REGISTRATION (After Modal) ================= */
const googleRegister = async (req, res) => {
  try {
    const { 
      role, 
      googleData, 
      employeeDetails // { companyId, branchId, departmentId, designationId, shiftId }
    } = req.body;

    if (role === "Admin") {
      // --- Create Admin Immediately ---
      const newUser = new userTbl({
        name: googleData.name,
        email: googleData.email,
        role: "admin",
        authProvider: "google",
        googleId: googleData.googleId,
        profilePic: googleData.profilePic,
        status: "active",
      });

      // Assign Company ID as own ID
      newUser.companyId = newUser._id;
      await newUser.save();

      const token = jwt.sign(
        { id: newUser._id, role: "admin", companyId: newUser._id },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.json({
        success: true,
        mode: "CREATED_ADMIN",
        token,
        data: newUser,
      });

    } else if (role === "Employee") {
      // --- Create Pending User ---
      
      // Validate required fields
      if (!employeeDetails.companyId || !employeeDetails.branchId) {
        return res.status(400).json({ success: false, message: "Company & Branch details are required." });
      }

      const newPending = new pendingTbl({
        name: googleData.name,
        email: googleData.email,
        authProvider: "google",
        googleId: googleData.googleId,
        profilePic: googleData.profilePic,
        
        // Employee Specific Fields
        companyId: employeeDetails.companyId,
        branchId: employeeDetails.branchId,
        departmentId: employeeDetails.departmentId,
        designationId: employeeDetails.designationId,
        shiftId: employeeDetails.shiftId,
      });

      await newPending.save();

      return res.json({
        success: true,
        mode: "CREATED_PENDING",
        message: "Registration successful! Please wait for Admin approval.",
      });
    }

  } catch (error) {
    console.error("Google Register Error:", error);
    res.status(500).json({ success: false, message: "Registration failed" });
  }
};
/* ================= GET MY PROFILE (Token Based - No Params) ================= */
// Ye function Admin aur Employee dono use kar sakte hain apni profile dekhne ke liye
const getMyProfile = async (req, res) => {
  try {
    // ID seedha Token se lo (jo Auth middleware ne set ki hai)
    const userId = req.user._id; 

    const user = await userTbl.findById(userId)
      .select("-passwordHash")
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .populate("branchId", "name");

    if (!user) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Profile Fetch Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/* ================= UPDATE MY PROFILE (With Email, Password & Instant Refresh) ================= */
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user._id; 

    // 1. Check if user exists
    const user = await userTbl.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 2. Email Uniqueness Check
    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await userTbl.findOne({ 
          email: req.body.email, 
          _id: { $ne: userId } 
      });
      if (emailExists) {
        return res.status(400).json({ success: false, message: "Email already in use by another user." });
      }
    }

    // 3. Image Upload Logic
    let profilePic = user.profilePic;
    if (req.files?.profilePic) {
      const img = req.files.profilePic;
      const uploadPath = "uploads/profiles";
      
      if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

      if (profilePic) {
        const oldImg = path.join("uploads", profilePic);
        if (fs.existsSync(oldImg)) fs.unlinkSync(oldImg);
      }

      const filename = `${Date.now()}_${img.name}`;
      await img.mv(path.join(uploadPath, filename));
      profilePic = `profiles/${filename}`;
    }

    // 4. Prepare Update Data
    const updateData = {
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email, 
      profilePic: profilePic
    };

    // NEW: Hash and update password if provided
    if (req.body.password) {
      const bcrypt = require("bcryptjs");
      updateData.passwordHash = await bcrypt.hash(req.body.password, 10);
    }

    // 5. Update Database
    const updatedUser = await userTbl.findByIdAndUpdate(userId, updateData, { new: true });

    // 6. Send Updated Data back to Frontend
    res.json({ 
        success: true, 
        message: "Profile Updated Successfully",
        data: updatedUser 
    });

  } catch (error) {
    console.error("Profile Update Error:", error);
    res.status(500).json({ success: false, message: "Update Failed" });
  }
};

/* ================= EXPORT ================= */
module.exports = {
    getMyProfile,     // ✅ NEW
  updateMyProfile,
  register,
  login,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  userForgetPassword,
  userResetPassword,
  userVerifyPassword,
  getPendingUsers,
  approvePendingUser,
  rejectPendingUser,
  getBirthdaysAndAnniversaries,
  getAllEmployeeDates,
  googleLogin,
  googleAuthCheck,
  googleRegister
};