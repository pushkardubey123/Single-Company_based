const Application = require("../Modals/Application");
const path = require("path");
const fs = require("fs");
const Job = require("../Modals/Job");

exports.applyJob = async (req, res) => {
  try {
    const job = await Job.findById(req.body.jobId);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const body = {
      ...req.body,
      companyId: job.companyId,
      branchId: job.branchId,
    };

    if (req.files) {
      const uploadDir = "uploads/applications";
      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });

      if (req.files.profileImage) {
        const profileImage = req.files.profileImage;
        const profilePath = path.join(
          uploadDir,
          Date.now() + "-" + profileImage.name
        );
        await profileImage.mv(profilePath);
        body.profileImage = profilePath;
      }

      if (req.files.resume) {
        const resume = req.files.resume;
        const resumePath = path.join(uploadDir, Date.now() + "-" + resume.name);
        await resume.mv(resumePath);
        body.resume = resumePath;
      }

      if (req.files.coverLetter) {
        const coverLetter = req.files.coverLetter;
        const coverPath = path.join(
          uploadDir,
          Date.now() + "-" + coverLetter.name
        );
        await coverLetter.mv(coverPath);
        body.coverLetter = coverPath;
      }
    }

    const application = await Application.create(body);
    res.status(201).json({ success: true, data: application });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getApplications = async (req, res) => {
  try {
    const filter = {
      companyId: req.companyId,
    };

    // 🔥 only restrict branch if branchId exists (branch admin)
    if (req.branchId) {
      filter.branchId = req.branchId;
    }

    const apps = await Application.find(filter)
      .populate("jobId", "title")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getApplicationById = async (req, res) => {
  try {
    const filter = {
      _id: req.params.id,
      companyId: req.companyId,
    };

    if (req.branchId) {
      filter.branchId = req.branchId;
    }

    const application = await Application.findOne(filter)
      .populate("jobId", "title description");

    if (!application) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    res.json({ success: true, data: application });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};


exports.rejectApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findByIdAndUpdate(
      id,
      { status: "rejected" },
      { new: true }
    );
    res.json({ success: true, message: "Application rejected", application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.shortlistApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findByIdAndUpdate(
      id,
      { status: "shortlisted" },
      { new: true }
    );
    res.json({
      success: true,
      message: "Application shortlisted",
      application,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
