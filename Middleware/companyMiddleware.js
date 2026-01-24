
module.exports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "User missing" });
  }

  // company
  if (req.user.role === "admin") {
    req.companyId = req.user._id || req.user.id;
  } else {
    req.companyId = req.user.companyId;
  }

  req.branchId = req.user.branchId;

  next();
};

