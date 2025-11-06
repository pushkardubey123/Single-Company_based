const Job = require("../Modals/Job");

exports.addJob = async (req, res) => {
  try {
    const body = { ...req.body };

    if (typeof body.skills === "string") {
      body.skills = body.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const job = await Job.create(body);
    res.status(201).json({ success: true, data: job });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getJobs = async (req, res) => {
  try {
    const data = await Job.find()
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate("departmentId", "name")
      .populate("designationId", "name");
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const body = { ...req.body };
    if (typeof body.skills === "string") {
      body.skills = body.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const job = await Job.findByIdAndUpdate(req.params.id, body, { new: true });
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
