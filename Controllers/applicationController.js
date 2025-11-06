const Application = require("../Modals/Application");
const path = require("path");
const fs = require("fs");

exports.applyJob = async (req, res) => {
  try {
    const body = { ...req.body };

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
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getApplications = async (req, res) => {
  try {
    const data = await Application.find().populate(
      "jobId",
      "title departmentId designationId"
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getApplicationById = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).populate(
      "jobId",
      "title description"
    );
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
