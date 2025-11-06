const jwt = require("jsonwebtoken");
const User = require("../Modals/User");

const authMiddleware = async (req, res, next) => {
  const rawHeader = req.header("Authorization");
  const token = rawHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: true,
      message: "Access denied. Token missing.",
      code: 401,
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Get full user details
    const user = await User.findById(decoded.id).select("name email role");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: true,
        message: "Invalid token. User not found.",
        code: 401,
      });
    }

    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: true,
      message: "Invalid token",
      code: 401,
    });
  }
};

module.exports = authMiddleware;
