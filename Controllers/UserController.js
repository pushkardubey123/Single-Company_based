const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userTbl = require("../Modals/User");
const sendOTP = require("../utils/sendOtp");
const pendingTbl = require("../Modals/PendingUser");
const fs = require("fs");
const path = require("path");

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
      branchId
    } = req.body;

    const emailExists =
      (await pendingTbl.findOne({ email })) ||
      (await userTbl.findOne({ email }));
    if (emailExists) {
      return res.json({
        success: false,
        error: true,
        message: "Email already exists",
        code: 400,
      });
    }

    let profilePic = null;
    if (req.files && req.files.profilePic) {
      const img = req.files.profilePic;

      const uploadPath = "uploads/profiles";
      const fs = require("fs");
      const path = require("path");
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      const filename = Date.now() + "_" + img.name;
      const fullPath = path.join(uploadPath, filename);

      await img.mv(fullPath, (err) => {
        if (err) {
          return res.status(500).json({
            success: false,
            code: 500,
            message: "Error during file uploading",
            error: true,
          });
        }
      });

      profilePic = `profiles/${filename}`;
    }

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
      emergencyContact: JSON.parse(emergencyContact),
      profilePic: profilePic || null,
      pan,
      bankAccount,
      branchId
    });

    await pendingUser.save();

    res.json({
      success: true,
      message: "Registration pending admin approval",
      code: 201,
    });
  } catch {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getPendingUsers = async (req, res) => {
  try {
    const users = await pendingTbl
      .find()
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .populate("shiftId", "name")
      .populate("branchId", "name");

    res.json({
      success: true,
      error: false,
      message: "Pending users fetched",
      code: 200,
      data: users,
    });
  } catch {
    res.status(500).json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

const approvePendingUser = async (req, res) => {
  try {
    const pendingUser = await pendingTbl.findById(req.params.id);
    const { basicSalary } = req.body;
    if (!pendingUser) {
      return res
        .status(404)
        .json({ success: false, message: "Pending user not found" });
    }

    const hashedPassword = await bcrypt.hash(pendingUser.password, 10);

const user = new userTbl({
  ...pendingUser.toObject(),
  passwordHash: hashedPassword,
  role: "employee",
  basicSalary: basicSalary || 0,
  branchId: pendingUser.branchId
});


    await user.save();
    await pendingTbl.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "User approved and moved to main DB" });
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: "Error approving user" });
  }
};

const rejectPendingUser = async (req, res) => {
  try {
    const user = await pendingTbl.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Pending user not found" });
    }

    if (user.profilePic) {
      const imagePath = path.join(__dirname, "..", "uploads", user.profilePic);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await pendingTbl.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "User request rejected" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to reject user" });
  }
};

const login = async (req, res) => {
  
  try {
    const { email, password } = req.body;
    const user = await userTbl.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.json({
        success: false,
        error: true,
        message: "password wrong!",
        code: 400,
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      error: false,
      message: "Login successful",
      code: 200,
      token,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePic: user.profilePic,
        phone: user.phone,
        departmentId: user.departmentId,
        designationId: user.designationId,
        shiftId: user.shiftId,
        status: user.status,
      },
    });
  } catch (err) {
  console.error("Login Error:", err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
}
};

const userForgetPassword = async (req, res) => {
  const { email } = req.body;

  const user = await userTbl.findOne({ email });
  if (!user) {
    return res
      .status(404)
      .json({ success: false, message: "Email is not Exist" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.otp = otp;
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendOTP(email, otp);

  res.json({ success: true, message: "OTP sending successfully !" });
};

const userVerifyPassword = async (req, res) => {
  const { email, otp } = req.body;

  const user = await userTbl.findOne({ email });

  if (!user || user.otp !== otp || user.otpExpires < new Date()) {
    return res
      .status(400)
      .json({ success: false, message: "OTP is wrong or OTP is expired !" });
  }

  res.json({ success: true, message: "OTP is right,Enter New Passsword" });
};

const userResetPassword = async (req, res) => {
  const { email, newPassword, otp } = req.body;

  const user = await userTbl.findOne({ email });

  if (!user || user.otp !== otp || user.otpExpires < new Date()) {
    return res
      .status(400)
      .json({ success: false, message: "OTP is wrong or expired !" });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  res.json({ success: true, message: "Password changed !" });
};
const getAllUsers = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.json({
      success: false,
      error: true,
      message: "Access denied",
      code: 403,
    });
  }
  try {
    const users = await userTbl
      .find({ role: "employee" })
      .select("-passwordHash")
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .populate("shiftId", "name")
      .populate("branchId", "name");

    res.json({
      success: true,
      error: false,
      message: "Users fetched",
      code: 200,
      data: users,
    });
  } catch (err) {
    res.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

const getUserById = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.json({
      success: false,
      error: true,
      message: "Access denied",
      code: 403,
    });
  }
  try {
    const user = await userTbl
      .findById(req.params.id)
      .select("-passwordHash")
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .populate("shiftId", "name");
    if (!user) {
      return res.json({
        success: false,
        error: true,
        message: "Not found",
        code: 404,
      });
    }
    res.json({
      success: true,
      error: false,
      message: "User found",
      code: 200,
      data: user,
    });
  } catch {
    res.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const emp = await userTbl.findById(req.params.id);
    if (!emp) return res.status(404).json({ message: "User not found" });

    let profilePic = em
    if (req.files && req.files.profilePic) {
      const img = req.files.profilePic;
      const uploadPath = "uploads/profiles";

      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      if (profilePic) {
        const oldImage = path.join("uploads", profilePic);
        if (fs.existsSync(oldImage)) fs.unlinkSync(oldImage);
      }

      const filename = Date.now() + "_" + img.name;
      const fullPath = path.join(uploadPath, filename);

      await img.mv(fullPath);

      profilePic = `profiles/${filename}`;
    }

    await userTbl.findByIdAndUpdate(req.params.id, {
      ...req.body,
      profilePic
    });

    res.json({ success: true, message: "Employee updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Update failed" });
  }
};


const deleteUser = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.json({
      success: false,
      error: true,
      message: "Access denied",
      code: 403,
    });
  }

  try {
    const user = await userTbl.findById(req.params.id);
    if (!user) {
      return res.json({
        success: false,
        error: true,
        message: "User not found",
        code: 404,
      });
    }

    if (user.profilePic) {
      const imagePath = path.join(__dirname, "..", "uploads", user.profilePic);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await userTbl.findByIdAndDelete(req.params.id);

    res.json({ success: true, error: false, message: "Deleted", code: 200 });
  } catch {
    res.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

const getBirthdaysAndAnniversaries = async (req, res) => {
  try {
    const users = await userTbl.find({ role: "employee", status: "active" });

    const today = new Date();
    const todayMonthDay = `${today.getMonth() + 1}-${today.getDate()}`;

    const birthdays = [];
    const anniversaries = [];

    users.forEach((user) => {
      const dob = new Date(user.dob);
      const doj = new Date(user.doj);

      const dobMonthDay = `${dob.getMonth() + 1}-${dob.getDate()}`;
      const dojMonthDay = `${doj.getMonth() + 1}-${doj.getDate()}`;

      if (dobMonthDay === todayMonthDay) {
        birthdays.push(user);
      }
      if (dojMonthDay === todayMonthDay) {
        anniversaries.push(user);
      }
    });

    res.json({
      success: true,
      message: "Birthdays and anniversaries fetched",
      code: 200,
      data: {
        birthdays,
        anniversaries,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: 500,
    });
  }
};

const getAllEmployeeDates = async (req, res) => {
  try {
    const employees = await userTbl.find({ role: "employee" }, "name dob doj");

    res.json({
      success: true,
      message: "Employee DOB and DOJ list fetched",
      code: 200,
      data: employees,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee DOB and DOJ",
      code: 500,
      error: true,
    });
  }
};

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
