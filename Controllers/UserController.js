const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const userTbl = require("../Modals/User");
const pendingTbl = require("../Modals/PendingUser");
const sendOTP = require("../utils/sendOtp");

/* ================= REGISTER ================= */
const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      gender,
      dob,
      address,
      departmentId,
      designationId,
      shiftId,
      doj,
      emergencyContact,
      pan,
      bankAccount,
      branchId,
      basicSalary,
    } = req.body;

    // 🔐 Resolve company
    const finalCompanyId =
      req.user && req.user.role === "admin"
        ? req.user.companyId
        : req.body.companyId;

    if (!finalCompanyId)
      return res.status(400).json({ success: false, message: "Company required" });

    if (!branchId)
      return res.status(400).json({ success: false, message: "Branch required" });

    // ❌ Email check (both tables)
    const emailExists =
      (await userTbl.findOne({ email })) ||
      (await pendingTbl.findOne({ email }));

    if (emailExists)
      return res.status(400).json({ success: false, message: "Email already exists" });

    /* ================= PROFILE PIC ================= */
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
      console.log(req.user)

      const user = new userTbl({
        name,
        email,
        phone,
        gender,
        dob,
        address,
        departmentId,
        designationId,
        shiftId,
        doj,
        emergencyContact: emergencyContact
          ? JSON.parse(emergencyContact)
          : null,
        profilePic,
        pan,
        bankAccount,
        branchId,
        companyId: finalCompanyId,
        passwordHash,
        role: "employee",
        basicSalary: basicSalary || 0,
      });

      await user.save();

      return res.status(201).json({
        success: true,
        message: "Employee added successfully",
      });
    }

    /* ================= PUBLIC REGISTRATION ================= */
    const pendingUser = new pendingTbl({
      name,
      email,
      password,
      phone,
      gender,
      dob,
      address,
      departmentId,
      designationId,
      shiftId,
      doj,
      emergencyContact: emergencyContact
        ? JSON.parse(emergencyContact)
        : null,
      profilePic,
      pan,
      bankAccount,
      branchId,
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

/* ================= APPROVE PENDING USER ================= */
const approvePendingUser = async (req, res) => {
  try {
    const { basicSalary } = req.body;

    if (!basicSalary) {
      return res.status(400).json({
        success: false,
        message: "Basic salary is required",
      });
    }

    const pendingUser = await pendingTbl.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!pendingUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(pendingUser.password, 10);

    const user = new userTbl({
      ...pendingUser.toObject(),
      passwordHash: hashedPassword,
      role: "employee",
      companyId: req.companyId,
      basicSalary, // ✅ yahin add
    });

    await user.save();
    await pendingTbl.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "User approved with salary" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Approval failed" });
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

/* ================= EXPORT ================= */
module.exports = {
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
};
