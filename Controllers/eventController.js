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
      createdBy,
    } = req.body;

    const newEvent = new Event({
      title,
      description,
      startDate,
      endDate,
      color,
      departmentId,
      employeeId,
      createdBy,
    });

    const savedEvent = await newEvent.save();

    res.status(201).json({
      message: "Event created successfully",
      event: savedEvent,
    });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getAllEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate("createdBy", "name email")
      .populate("departmentId", "name")
      .populate("employeeId", "name email");
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const updated = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Event deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

exports.gelOneEvent = async (req, res) => {
  try {
    const userId = req.params.id;

    const employee = await User.findById(userId);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const departmentIds = Array.isArray(employee.department)
      ? employee.department
      : [employee.department];

    const events = await Event.find({
      $or: [
        { employeeId: userId },
        { departmentId: { $in: departmentIds } },
      ],
    })
      .populate("createdBy", "name")
      .populate("departmentId", "name");

    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching employee events:", error);
    res.status(500).json({ error: "Failed to fetch employee events" });
  }
}