const Event = require("../Modals/Event");
const User = require("../Modals/User");
exports.createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      startDate,
      endDate,
      color,
      departmentId,
      employeeId,
      branchId, // ✅ ADD THIS
    } = req.body;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Branch is required",
      });
    }

    const newEvent = new Event({
      companyId: req.companyId,
      branchId, // ✅ SAVE IT
      title,
      description,
      startDate,
      endDate,
      color,
      departmentId,
      employeeId,
      createdBy: req.user._id,
    });

    const savedEvent = await newEvent.save();

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      event: savedEvent,
    });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getAllEvents = async (req, res) => {
  try {
    const filter = {
      companyId: req.companyId,
    };

    if (req.user.role !== "admin") {
      filter.branchId = req.branchId;
    }

    const events = await Event.find(filter)
      .populate("createdBy", "name email")
      .populate("departmentId", "name")
      .populate("employeeId", "name email");

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const updated = await Event.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.companyId,
        branchId: req.branchId,
      },
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.deleteEvent = async (req, res) => {
  try {
    const deleted = await Event.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId,
      branchId: req.branchId,
    });

    if (!deleted) {
      return res.status(404).json({ success: false });
    }

    res.json({ success: true, message: "Event deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.gelOneEvent = async (req, res) => {
  try {
    const userId = req.params.id;

    const employee = await User.findOne({
      _id: userId,
      companyId: req.companyId,
      branchId: req.branchId,
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const departmentIds = Array.isArray(employee.department)
      ? employee.department
      : [employee.department];

    const events = await Event.find({
      companyId: req.companyId,
      branchId: req.branchId,
      $or: [
        { employeeId: userId },
        { departmentId: { $in: departmentIds } },
      ],
    })
      .populate("createdBy", "name")
      .populate("departmentId", "name");

    res.json({ success: true, data: events });
  } catch (error) {
    console.error("Error fetching employee events:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
