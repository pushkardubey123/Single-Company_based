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
const AssetAssignment = require("../Modals/Asset/AssetAssignment");
const CompanySubscription = require("../Modals/SuperAdmin/CompanySubscription"); // 🔥 NAYA IMPORT STORAGE KE LIYE

// ✅ STATIC FILE SIZE LIMIT (2MB). 100KB karna ho toh: 100 * 1024 likhein.
const MAX_PROFILE_PIC_SIZE = 2 * 1024 * 1024; 

// ==============================================================
// 🔥 HELPER 1: STRICT AUTO-TRIAL ASSIGNER
// ==============================================================
const assignTrialPlan = async (companyId) => {
  try {
    const Plan = require("../Modals/SuperAdmin/Plan");
    const trialPlan = await Plan.findOne({ isTrial: true, status: "active" });
    
    if (!trialPlan) return;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + trialPlan.durationDays);

    await CompanySubscription.create({
      companyId: companyId,
      planId: trialPlan._id,
      validUpto: expiryDate,
      isTrial: true,
      status: "active",
      usage: { totalEmployees: 1, storageUsedMB: 0 } // Initialize usage
    });
  } catch (error) {
    console.error("Trial Assign failed:", error);
  }
};

// ==============================================================
// 🔥 HELPER 2: STRICT EMPLOYEE LIMIT CHECKER
// ==============================================================
const checkEmployeeLimit = async (companyId) => {
  const sub = await CompanySubscription.findOne({ companyId }).populate("planId");
  
  if (!sub || !sub.planId) return { allowed: false, limit: 0 };
  
  const maxEmp = sub.planId.limits?.maxEmployees ?? 0;
  if (maxEmp === -1) return { allowed: true }; // Unlimited
  
  const currentEmpCount = await userTbl.countDocuments({ companyId, role: "employee" });
  return { allowed: currentEmpCount < maxEmp, limit: maxEmp };
};

const initializeLeaveBalance = async (companyId, employeeId) => {
  const currentYear = new Date().getFullYear();
  const employee = await userTbl.findById(employeeId);
  if (!employee) return;

  const doj = moment(employee.doj); 
  const policies = await LeavePolicy.find({ companyId, isDeleted: false, isActive: true });

  for (const policy of policies) {
    const exists = await LeaveBalance.findOne({
      employeeId, leaveTypeId: policy.leaveTypeId, year: currentYear,
    });

    if (!exists) {
      let initialCredit = 0;
      if (policy.accrualType === "Yearly") {
        if (doj.year() === currentYear) {
          const joinedMonth = doj.month(); 
          const remainingMonths = 12 - joinedMonth;
          const perMonthRate = policy.accrualRate / 12; 
          initialCredit = Math.round(perMonthRate * remainingMonths);
        } else {
          initialCredit = policy.accrualRate; 
        }
      } else if (policy.accrualType === "Monthly") {
        initialCredit = 0; 
      }

      await LeaveBalance.create({
        employeeId, companyId, leaveTypeId: policy.leaveTypeId,
        year: currentYear, totalCredited: initialCredit, used: 0, carryForwarded: 0,
        lastAccruedMonth: policy.accrualType === "Monthly" ? null : moment().format("YYYY-MM") 
      });
    }
  }
};


const register = async (req, res) => {
  try {
    const {
      name, email, password, phone, role, gender, dob, address, departmentId, 
      designationId, shiftId, doj, emergencyContact, pan, bankAccount, branchId, basicSalary, companyId
    } = req.body;

    // --- ADMIN REGISTRATION ---
    if (role === "admin") {
      const emailExists = await userTbl.findOne({ email });
      if (emailExists) return res.status(400).json({ success: false, message: "Email already exists" });

      const passwordHash = await bcrypt.hash(password, 10);
      const newAdmin = new userTbl({
        name, email, phone, passwordHash, role: "admin", status: "active", authProvider: "local"
      });
      newAdmin.companyId = newAdmin._id; // Admin ki companyId wo khud hai
      await newAdmin.save();
      await assignTrialPlan(newAdmin._id);

      // 🔥 FIX: GENERATE AND RETURN TOKEN FOR PAYMENT GATEWAY 🔥
      const token = jwt.sign(
        { 
          id: newAdmin._id, 
          role: newAdmin.role, 
          companyId: newAdmin._id, 
          designationId: newAdmin.designationId 
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: "1d" }
      );

      return res.status(201).json({ 
        success: true, 
        message: "Admin account created successfully with Trial Plan!",
        token: token // This is crucial for the next /create-order step
      });
    }

    // --- EMPLOYEE REGISTRATION (Public or Admin Adding) ---
    const tokenHeader = req.headers.authorization?.split(" ")[1];
    let decodedAdmin = null;
    if (tokenHeader && tokenHeader !== "undefined" && tokenHeader !== "null") {
      try { decodedAdmin = jwt.verify(tokenHeader, process.env.JWT_SECRET); } catch (e) { }
    }

    const isAdminAdding = decodedAdmin && decodedAdmin.role === "admin";
    const finalCompanyId = isAdminAdding ? (decodedAdmin.companyId || decodedAdmin.id) : companyId;

    if (!finalCompanyId) return res.status(400).json({ success: false, message: "Company required" });
    if (!branchId) return res.status(400).json({ success: false, message: "Branch required" });

    // 🔥 STRICT EMPLOYEE LIMIT CHECK
    if (isAdminAdding) {
      const limitStatus = await checkEmployeeLimit(finalCompanyId);
      if (!limitStatus.allowed) {
        return res.status(403).json({ 
          success: false, 
          message: `Plan Limit Reached! Your plan allows a maximum of ${limitStatus.limit} employees.` 
        });
      }
    }

    const emailExists = (await userTbl.findOne({ email })) || (await pendingTbl.findOne({ email }));
    if (emailExists) return res.status(400).json({ success: false, message: "Email already exists" });

    let profilePic = null;
    let storageAddedMB = 0; 

    if (req.files?.profilePic) {
      const img = req.files.profilePic;
      if (img.size > MAX_PROFILE_PIC_SIZE) {
         return res.status(400).json({ success: false, message: "Profile picture must be under 2MB" });
      }

      const uploadPath = "uploads/profiles";
      if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
      const filename = `${Date.now()}_${img.name}`;
      await img.mv(path.join(uploadPath, filename));
      profilePic = `profiles/${filename}`;
      storageAddedMB = img.size / (1024 * 1024);
    }

    // ✅ DIRECT ADD FOR ADMIN (NO PENDING TABLE)
    if (isAdminAdding) {
      const passwordHash = await bcrypt.hash(password, 10);
      const user = new userTbl({
        name, email, phone, gender, dob, address, departmentId, designationId, shiftId, doj,
        emergencyContact: emergencyContact ? JSON.parse(emergencyContact) : null,
        profilePic, pan, bankAccount, branchId, companyId: finalCompanyId,
        passwordHash, role: "employee", 
        basicSalary: basicSalary || 0,
      });

      await user.save();
      await initializeLeaveBalance(user._id, finalCompanyId);

      if (storageAddedMB > 0) {
         await CompanySubscription.findOneAndUpdate(
           { companyId: finalCompanyId },
           { $inc: { "usage.storageUsedMB": storageAddedMB } }
         );
      }

      try {
        const OnboardingRule = require("../Modals/Asset/OnboardingRule");
        const rules = await OnboardingRule.find({ companyId: finalCompanyId });
        if (rules.length > 0) {
          const assetRequests = rules.map(rule => ({
            companyId: finalCompanyId, branchId: user.branchId, employeeId: user._id,
            issueDate: new Date(), status: "Requested", requestedAssetName: rule.assetName, 
            requestedAssetType: rule.assetType, notes: `Auto-triggered: Needs ${rule.assetName} for Onboarding`,
          }));
          const AssetAssignment = require("../Modals/Asset/AssetAssignment");
          await AssetAssignment.insertMany(assetRequests);
        }
      } catch (assetErr) {}

      return res.status(201).json({ success: true, message: "Employee successfully added to the system!" });
    }

    // ❌ PUBLIC REGISTRATION (Pending Table)
    const pendingUser = new pendingTbl({
      name, email, password, phone, gender, dob, address, departmentId, designationId,
      shiftId, doj, emergencyContact: emergencyContact ? JSON.parse(emergencyContact) : null,
      profilePic, pan, bankAccount, branchId, companyId: finalCompanyId,
    });

    await pendingUser.save();

    if (storageAddedMB > 0) {
      await CompanySubscription.findOneAndUpdate(
        { companyId: finalCompanyId },
        { $inc: { "usage.storageUsedMB": storageAddedMB } }
      );
    }

    res.status(201).json({ success: true, message: "Registration pending admin approval" });

  } catch (err) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


/* ================= APPROVE PENDING USER ================= */
const approvePendingUser = async (req, res) => {
  try {
    const { basicSalary } = req.body;
    if (!basicSalary) return res.status(400).json({ success: false, message: "Basic salary is required" });

    const limitStatus = await checkEmployeeLimit(req.companyId);
    if (!limitStatus.allowed) {
      return res.status(403).json({ success: false, message: `Plan Limit Reached! Limit is ${limitStatus.limit} employees.` });
    }

    const pendingUser = await pendingTbl.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!pendingUser) return res.status(404).json({ success: false, message: "User not found" });

    let hashedPassword = undefined;
    if (pendingUser.password) hashedPassword = await bcrypt.hash(pendingUser.password, 10);

    const user = new userTbl({
      ...pendingUser.toObject(),
      passwordHash: hashedPassword, 
      role: "employee", companyId: req.companyId, basicSalary,
    });

    await user.save();
    await initializeLeaveBalance(user._id, req.companyId);

    // Auto Asset Trigger
    try {
      const OnboardingRule = require("../Modals/Asset/OnboardingRule");
      const rules = await OnboardingRule.find({ companyId: req.companyId });
      if (rules.length > 0) {
        const assetRequests = rules.map(rule => ({
          companyId: req.companyId, branchId: user.branchId, employeeId: user._id,
          issueDate: new Date(), status: "Requested", requestedAssetName: rule.assetName, 
          requestedAssetType: rule.assetType, notes: `Auto-triggered: Needs ${rule.assetName} for Onboarding`,
        }));
        await AssetAssignment.insertMany(assetRequests);
      }
    } catch (assetErr) { }

    await pendingTbl.findByIdAndDelete(req.params.id);
    // Note: No storage modification here because the file was already counted when the pending user registered.
    res.json({ success: true, message: "User approved, Leaves Assigned & Asset Requested" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Approval failed" });
  }
};

/* ================= REJECT PENDING USER (🔥 MINUS STORAGE) ================= */
const rejectPendingUser = async (req, res) => {
  try {
    const pendingUser = await pendingTbl.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!pendingUser) return res.status(404).json({ success: false, message: "Pending user not found" });

    let sizeToMinusMB = 0;
    if (pendingUser.profilePic) {
      const imgPath = path.join(__dirname, "..", "uploads", pendingUser.profilePic);
      if (fs.existsSync(imgPath)) {
        sizeToMinusMB = fs.statSync(imgPath).size / (1024 * 1024);
        fs.unlinkSync(imgPath); // Delete file from server
      }
    }

    await pendingTbl.findByIdAndDelete(req.params.id);

    // 🔥 MINUS STORAGE 🔥
    if (sizeToMinusMB > 0) {
      await CompanySubscription.findOneAndUpdate(
        { companyId: req.companyId },
        { $inc: { "usage.storageUsedMB": -sizeToMinusMB } }
      );
    }

    res.json({ success: true, message: "User rejected and data cleared" });
  } catch (error) { 
    res.status(500).json({ success: false, message: "Reject failed" }); 
  }
};

/* ================= UPDATE USER (🔥 EDIT PROFILE WITH STORAGE CALC) ================= */
const updateUser = async (req, res) => {
  try {
    const emp = await userTbl.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!emp) return res.status(404).json({ message: "User not found" });
    
    let profilePic = emp.profilePic;
    let storageChangeMB = 0; // 🔥 Track difference

    if (req.files?.profilePic) {
      const img = req.files.profilePic;

      // ✅ STATIC SIZE CHECK
      if (img.size > MAX_PROFILE_PIC_SIZE) {
         return res.status(400).json({ success: false, message: "Profile picture must be under 2MB" });
      }

      const uploadPath = "uploads/profiles";
      if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
      
      // Minus old image size
      if (profilePic) { 
         const oldImg = path.join(__dirname, "..", "uploads", profilePic); 
         if (fs.existsSync(oldImg)) {
            storageChangeMB -= (fs.statSync(oldImg).size / (1024 * 1024));
            fs.unlinkSync(oldImg); 
         } 
      }
      
      // Add new image size
      const filename = `${Date.now()}_${img.name}`;
      await img.mv(path.join(uploadPath, filename));
      profilePic = `profiles/${filename}`;
      storageChangeMB += (img.size / (1024 * 1024));
    }
    
    await userTbl.findByIdAndUpdate(req.params.id, { ...req.body, profilePic });

    // 🔥 UPDATE STORAGE DIFFERENCE 🔥
    if (storageChangeMB !== 0) {
      await CompanySubscription.findOneAndUpdate(
        { companyId: req.companyId },
        { $inc: { "usage.storageUsedMB": storageChangeMB } }
      );
    }

    res.json({ success: true, message: "User updated successfully" });
  } catch (error) { 
    res.status(500).json({ success: false, message: "Update failed" }); 
  }
};

/* ================= DELETE USER (🔥 MINUS STORAGE) ================= */
const deleteUser = async (req, res) => {
  try {
    const user = await userTbl.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    
    let sizeToMinusMB = 0;
    if (user.profilePic) { 
       const imgPath = path.join(__dirname, "..", "uploads", user.profilePic); 
       if (fs.existsSync(imgPath)) {
          sizeToMinusMB = fs.statSync(imgPath).size / (1024 * 1024);
          fs.unlinkSync(imgPath); 
       } 
    }
    await userTbl.findByIdAndDelete(req.params.id);

    // 🔥 MINUS STORAGE 🔥
    if (sizeToMinusMB > 0) {
      await CompanySubscription.findOneAndUpdate(
        { companyId: req.companyId }, 
        { $inc: { "usage.storageUsedMB": -sizeToMinusMB } }
      );
    }

    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) { 
    res.status(500).json({ success: false, message: "Delete failed" }); 
  }
};

/* ================= UPDATE MY PROFILE (Employee Self Edit) ================= */
const updateMyProfile = async (req, res) => {
  try {
    const user = await userTbl.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await userTbl.findOne({ email: req.body.email, _id: { $ne: req.user._id } });
      if (emailExists) return res.status(400).json({ success: false, message: "Email already in use." });
    }
    
    let profilePic = user.profilePic;
    let storageChangeMB = 0;

    if (req.files?.profilePic) {
      const img = req.files.profilePic;
      if (img.size > MAX_PROFILE_PIC_SIZE) return res.status(400).json({ success: false, message: "Profile picture must be under 2MB" });

      const uploadPath = "uploads/profiles";
      if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
      
      if (profilePic) { 
        const oldImg = path.join(__dirname, "..", "uploads", profilePic); 
        if (fs.existsSync(oldImg)) {
           storageChangeMB -= (fs.statSync(oldImg).size / (1024 * 1024));
           fs.unlinkSync(oldImg); 
        } 
      }
      
      const filename = `${Date.now()}_${img.name}`; 
      await img.mv(path.join(uploadPath, filename)); 
      profilePic = `profiles/${filename}`;
      storageChangeMB += (img.size / (1024 * 1024));
    }
    
    const updateData = { 
      name: req.body.name, phone: req.body.phone, email: req.body.email, 
      dob: req.body.dob, gender: req.body.gender, address: req.body.address, profilePic: profilePic 
    };
    
    if (req.body.emergencyContact) { try { updateData.emergencyContact = JSON.parse(req.body.emergencyContact); } catch(e) {} }
    if (req.body.password) updateData.passwordHash = await bcrypt.hash(req.body.password, 10);
    
    const updatedUser = await userTbl.findByIdAndUpdate(req.user._id, updateData, { new: true });

    // 🔥 UPDATE STORAGE DIFFERENCE 🔥
    if (storageChangeMB !== 0) {
      await CompanySubscription.findOneAndUpdate(
        { companyId: user.companyId },
        { $inc: { "usage.storageUsedMB": storageChangeMB } }
      );
    }

    res.json({ success: true, message: "Profile Updated", data: updatedUser });
  } catch (error) { 
    res.status(500).json({ success: false, message: "Update Failed" }); 
  }
};

/* ================= BASIC FUNCTIONS (NO STORAGE CHANGES) ================= */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userTbl.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(400).json({ success: false, message: "Invalid credentials" });
    const token = jwt.sign({ id: user._id, role: user.role, companyId: user.role === "admin" ? user._id : user.companyId, designationId: user.designationId }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ success: true, token, data: { id: user._id, name: user.name, email: user.email, role: user.role, companyId: user.companyId, profilePic: user.profilePic, designationId: user.designationId } });
  } catch (err) { res.status(500).json({ success: false, message: "Login failed" }); }
};

const getAllUsers = async (req, res) => {
  try {
    const { branchId, designationId } = req.query;
    const filter = { role: "employee", companyId: req.companyId };
    if (branchId) filter.branchId = branchId;
    if (designationId) filter.designationId = designationId;
    const users = await userTbl.find(filter).select("-passwordHash").populate("departmentId", "name").populate("designationId", "name").populate("shiftId", "name").populate("branchId", "name");
    res.json({ success: true, data: users });
  } catch { res.status(500).json({ success: false, message: "Internal Server Error" }); }
};

const getUserById = async (req, res) => {
  try {
    const user = await userTbl.findOne({ _id: req.params.id, companyId: req.companyId }).select("-passwordHash").populate("departmentId", "name").populate("designationId", "name").populate("shiftId", "name").populate("branchId", "name");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch { res.status(500).json({ success: false, message: "Internal Server Error" }); }
};

const getPendingUsers = async (req, res) => {
  try {
    const { branchId } = req.query;
    const filter = { companyId: req.companyId };
    if (branchId) filter.branchId = branchId;
    const users = await pendingTbl.find(filter).populate("departmentId", "name").populate("designationId", "name").populate("shiftId", "name").populate("branchId", "name");
    res.json({ success: true, data: users });
  } catch { res.status(500).json({ success: false, message: "Internal Server Error" }); }
};

const getBirthdaysAndAnniversaries = async (req, res) => {
  try {
    const users = await userTbl.find({ role: "employee", companyId: req.companyId, status: "active" });
    const today = new Date(); const md = `${today.getMonth() + 1}-${today.getDate()}`;
    const birthdays = []; const anniversaries = [];
    users.forEach((u) => {
      if (u.dob && `${u.dob.getMonth() + 1}-${u.dob.getDate()}` === md) birthdays.push(u);
      if (u.doj && `${u.doj.getMonth() + 1}-${u.doj.getDate()}` === md) anniversaries.push(u);
    });
    res.json({ success: true, data: { birthdays, anniversaries } });
  } catch { res.status(500).json({ success: false, message: "Error fetching dates" }); }
};

const getAllEmployeeDates = async (req, res) => {
  try {
    const data = await userTbl.find({ role: "employee", companyId: req.companyId }, "name dob doj branchId").populate("branchId", "name");
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, message: "Fetch failed" }); }
};

const getPublicCompanies = async (req, res) => {
  try {
    const companies = await userTbl.find({ role: "admin", status: "active" }).select("name _id");
    if (!companies) return res.status(404).json({ success: false, message: "No companies found" });
    res.json({ success: true, data: companies });
  } catch (error) { res.status(500).json({ success: false, message: "Failed to fetch companies" }); }
};

const userForgetPassword = async (req, res) => {
  const { email } = req.body; const user = await userTbl.findOne({ email });
  if (!user) return res.status(404).json({ success: false, message: "Email not found" });
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.otp = otp; user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); await user.save(); await sendOTP(email, otp);
  res.json({ success: true, message: "OTP sent" });
};

const userVerifyPassword = async (req, res) => {
  const { email, otp } = req.body; const user = await userTbl.findOne({ email });
  if (!user || user.otp !== otp || user.otpExpires < new Date()) return res.status(400).json({ success: false, message: "Invalid OTP" });
  res.json({ success: true, message: "OTP verified" });
};

const userResetPassword = async (req, res) => {
  const { email, newPassword, otp } = req.body; const user = await userTbl.findOne({ email });
  if (!user || user.otp !== otp || user.otpExpires < new Date()) return res.status(400).json({ success: false, message: "Invalid OTP" });
  user.passwordHash = await bcrypt.hash(newPassword, 10); user.otp = undefined; user.otpExpires = undefined; await user.save();
  res.json({ success: true, message: "Password reset successful" });
};

const googleLogin = async (req, res) => {
  try {
    const { credential, role } = req.body;
    const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const { email, name, sub, picture } = ticket.getPayload();
    let user = await userTbl.findOne({ email });
    if (user) {
      const token = jwt.sign({ id: user._id, role: user.role, companyId: user.role === "admin" ? user._id : user.companyId }, process.env.JWT_SECRET, { expiresIn: "1d" });
      return res.json({ success: true, token, data: { id: user._id, name: user.name, email: user.email, role: user.role, companyId: user.companyId, profilePic: user.profilePic } });
    } else {
      if (role === "Admin") {
        const newUser = new userTbl({ name, email, role: "admin", authProvider: "google", googleId: sub, profilePic: picture, status: "active" });
        newUser.companyId = newUser._id; await newUser.save(); await assignTrialPlan(newUser._id);
        const token = jwt.sign({ id: newUser._id, role: "admin", companyId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        return res.status(201).json({ success: true, message: "Admin registered", token, data: { id: newUser._id, name: newUser.name, email: newUser.email, role: "admin", companyId: newUser._id, profilePic: newUser.profilePic } });
      } else { return res.status(403).json({ success: false, message: "Employees must be registered by Admin first." }); }
    }
  } catch (error) { res.status(500).json({ success: false, message: "Google Authentication failed" }); }
};

const googleAuthCheck = async (req, res) => {
  try {
    const { credential } = req.body;
    const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const { email, name, sub, picture } = ticket.getPayload();
    let user = await userTbl.findOne({ email });
    if (user) {
      const token = jwt.sign({ id: user._id, role: user.role, companyId: user.role === "admin" ? user._id : user.companyId }, process.env.JWT_SECRET, { expiresIn: "1d" });
      return res.json({ success: true, mode: "LOGIN", token, data: { id: user._id, name: user.name, email: user.email, role: user.role, companyId: user.companyId, profilePic: user.profilePic } });
    }
    let pending = await pendingTbl.findOne({ email });
    if (pending) return res.status(403).json({ success: false, message: "Your account is awaiting Admin approval." });
    return res.json({ success: true, mode: "REGISTER", googleData: { email, name, googleId: sub, profilePic: picture } });
  } catch (error) { res.status(500).json({ success: false, message: "Google Authentication failed" }); }
};

const googleRegister = async (req, res) => {
  try {
    const { role, googleData, employeeDetails } = req.body;
    if (role === "Admin") {
      const newUser = new userTbl({ name: googleData.name, email: googleData.email, role: "admin", authProvider: "google", googleId: googleData.googleId, profilePic: googleData.profilePic, status: "active" });
      newUser.companyId = newUser._id; await newUser.save(); await assignTrialPlan(newUser._id);
      const token = jwt.sign({ id: newUser._id, role: "admin", companyId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
      return res.json({ success: true, mode: "CREATED_ADMIN", token, data: newUser });
    } else if (role === "Employee") {
      if (!employeeDetails.companyId || !employeeDetails.branchId) return res.status(400).json({ success: false, message: "Company & Branch details are required." });
      
      const limitStatus = await checkEmployeeLimit(employeeDetails.companyId);
      if (!limitStatus.allowed) return res.status(403).json({ success: false, message: `Plan Limit Reached! Limit is ${limitStatus.limit} employees.` });

      const token = req.headers.authorization?.split(" ")[1]; let decodedAdmin = null;
      if (token) try { decodedAdmin = jwt.verify(token, process.env.JWT_SECRET); } catch (e) { }

      if (decodedAdmin && decodedAdmin.role === "admin") {
         const user = new userTbl({
          name: googleData.name, email: googleData.email, authProvider: "google", googleId: googleData.googleId, profilePic: googleData.profilePic, companyId: employeeDetails.companyId, branchId: employeeDetails.branchId, departmentId: employeeDetails.departmentId, designationId: employeeDetails.designationId, shiftId: employeeDetails.shiftId, role: "employee", basicSalary: employeeDetails.basicSalary || 0
        });
        await user.save(); await initializeLeaveBalance(user._id, employeeDetails.companyId);
        return res.json({ success: true, mode: "CREATED_EMPLOYEE", message: "Employee successfully added via Google!" });
      }

      const newPending = new pendingTbl({
        name: googleData.name, email: googleData.email, authProvider: "google", googleId: googleData.googleId, profilePic: googleData.profilePic, companyId: employeeDetails.companyId, branchId: employeeDetails.branchId, departmentId: employeeDetails.departmentId, designationId: employeeDetails.designationId, shiftId: employeeDetails.shiftId,
      });
      await newPending.save(); return res.json({ success: true, mode: "CREATED_PENDING", message: "Registration successful! Please wait for Admin approval." });
    }
  } catch (error) { res.status(500).json({ success: false, message: "Registration failed" }); }
};

const getMyProfile = async (req, res) => {
  try {
    const user = await userTbl.findById(req.user._id).select("-passwordHash").populate("departmentId", "name").populate("designationId", "name").populate("branchId", "name");
    if (!user) return res.status(404).json({ success: false, message: "Profile not found" });
    res.json({ success: true, data: user });
  } catch (error) { res.status(500).json({ success: false, message: "Server Error" }); }
};

const getMySubscription = async (req, res) => {
  try {
    const sub = await CompanySubscription.findOne({ companyId: req.companyId }).populate("planId");
    if (!sub) return res.status(404).json({ success: false, message: "No subscription" });
    res.json({ success: true, data: sub });
  } catch (error) { res.status(500).json({ success: false, message: "Server Error" }); }
};

module.exports = {
  getMyProfile, updateMyProfile, register, login, getAllUsers, getUserById, updateUser, deleteUser,
  userForgetPassword, userResetPassword, userVerifyPassword, getPendingUsers, approvePendingUser,
  rejectPendingUser, getBirthdaysAndAnniversaries, getAllEmployeeDates, googleLogin, googleAuthCheck,
  googleRegister, getMySubscription, getPublicCompanies
};