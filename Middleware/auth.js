const jwt = require("jsonwebtoken");
const User = require("../Modals/User");

const authMiddleware = async (req, res, next) => {
  try {
    const rawHeader = req.header("Authorization");
    const token = rawHeader?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "Token missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select(
      "name email role companyId branchId"
    );

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    req.user = {
      _id: user._id,          
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      branchId: user.branchId, 
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

module.exports = authMiddleware;
