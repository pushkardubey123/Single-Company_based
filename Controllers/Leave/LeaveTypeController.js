const LeaveType = require("../../Modals/Leave/LeaveType");

/**
 * GET /api/leave-types
 */
exports.getLeaveTypes = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;

    const leaveTypes = await LeaveType.find({
      companyId,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: leaveTypes,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch leave types",
    });
  }
};


/**
 * POST /api/leave-types
 */
exports.createLeaveType = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;
    // daysAllowed destructured here
    const { name, description, isPaid, allowCarryForward, maxCarryForwardDays, daysAllowed } = req.body; 

    if (!name) return res.status(400).json({ success: false, message: "Leave name is required" });

    const leaveType = await LeaveType.create({
      companyId,
      name,
      description,
      // 🔥 Save Total Yearly Limit
      daysAllowed: daysAllowed || 12, // Default 12 agar admin na dale
      isPaid: !!isPaid,
      allowCarryForward: !!allowCarryForward,
      maxCarryForwardDays: allowCarryForward ? maxCarryForwardDays : 0,
      isDeleted: false,
    });

    res.status(201).json({ success: true, message: "Leave type created", data: leaveType });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create leave type" });
  }
};


/**
 * DELETE /api/leave-types/:id
 */
exports.deleteLeaveType = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;
    const { id } = req.params;

    const leaveType = await LeaveType.findOne({
      _id: id,
      companyId,
    });

    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: "Leave type not found",
      });
    }

    // 🔥 Soft delete (recommended)
leaveType.isDeleted = true;
await leaveType.save();


    res.json({
      success: true,
      message: "Leave type deleted",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to delete leave type",
    });
  }
};

exports.updateLeaveType = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { id } = req.params;

    const {
      name,
      daysAllowed,
      description,
      isPaid,
      
      allowCarryForward,
      maxCarryForwardDays,
    } = req.body;

    const leaveType = await LeaveType.findOne({
      _id: id,
      companyId,
      isDeleted: false,
    });

    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: "Leave type not found",
      });
    }

    // 🔒 Name uniqueness (ignore self)
    if (name && name !== leaveType.name) {
      const exists = await LeaveType.findOne({
        companyId,
        name: new RegExp(`^${name}$`, "i"),
        isDeleted: false,
        _id: { $ne: id },
      });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Leave type with same name already exists",
        });
      }
    }

    leaveType.name = name ?? leaveType.name;
    leaveType.daysAllowed = req.body.daysAllowed ?? leaveType.daysAllowed;
    leaveType.description = description ?? leaveType.description;
    leaveType.isPaid = typeof isPaid === "boolean" ? isPaid : leaveType.isPaid;
    leaveType.allowCarryForward =
      typeof allowCarryForward === "boolean"
        ? allowCarryForward
        : leaveType.allowCarryForward;

    leaveType.maxCarryForwardDays = leaveType.allowCarryForward
      ? maxCarryForwardDays ?? leaveType.maxCarryForwardDays
      : 0;

    await leaveType.save();

    res.json({
      success: true,
      message: "Leave type updated successfully",
      data: leaveType,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update leave type",
    });
  }
};
