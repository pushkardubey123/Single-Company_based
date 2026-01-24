const Lead = require("../Modals/LMS/Lead");
const LeadSource = require("../Modals/LMS/LeadSource");
const LeadStatus = require("../Modals/LMS/LeadStatus");
const LeadActivity = require("../Modals/LMS/LeadActivity");
const Project = require("../Controllers/projectController");

// Create new lead manually
exports.createLead = async (req, res) => {
  try {
    const { title, description, companyName, contacts, source, assignedTo, estimatedValue } = req.body;

    let leadSource = await LeadSource.findOne({ name: source });
    if (!leadSource) leadSource = await LeadSource.create({ name: source });

    let leadStatus = await LeadStatus.findOne({ name: "New" });
    if (!leadStatus) leadStatus = await LeadStatus.create({ name: "New", color: "#FF0000" });

    const lead = await Lead.create({
      title, description, companyName, contacts,
      source: leadSource._id, status: leadStatus._id,
      assignedTo, estimatedValue
    });

    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Automatic lead creation (for LinkedIn/social media/webhook)
exports.autoCreateLead = async (leadData) => {
  try {
    const { title, companyName, contacts, source } = leadData;

    let leadSource = await LeadSource.findOne({ name: source });
    if (!leadSource) leadSource = await LeadSource.create({ name: source });

    let leadStatus = await LeadStatus.findOne({ name: "New" });
    if (!leadStatus) leadStatus = await LeadStatus.create({ name: "New", color: "#FF0000" });

    const lead = await Lead.create({
      title, companyName, contacts,
      source: leadSource._id, status: leadStatus._id
    });

    console.log("Automatic Lead Added:", lead._id);
    return lead;
  } catch (err) {
    console.error("Error auto-creating lead:", err.message);
  }
};

// Convert lead to project
exports.convertLeadToProject = async (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    if (lead.convertedToProject)
      return res.status(400).json({ message: "Lead already converted" });

    const project = await Project.create({
      name: lead.title,
      description: lead.description,
      startDate: new Date(),
      assignedEmployees: lead.assignedTo ? [lead.assignedTo] : [],
    });

    lead.convertedToProject = true;
    lead.projectId = project._id;
    await lead.save();

    res.json({ success: true, message: "Lead converted to project", data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Add activity (call/email/meeting)
exports.addLeadActivity = async (req, res) => {
  try {
    const { leadId, activityType, description, employeeId } = req.body;

    const activity = await LeadActivity.create({
      leadId, activityType, description, employeeId
    });

    res.status(201).json({ success: true, data: activity });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all leads
exports.getAllLeads = async (req, res) => {
  try {
    const leads = await Lead.find()
      .populate("source", "name")
      .populate("status", "name color")
      .populate("assignedTo", "name email")
      .populate("projectId", "name status");
    res.json({ success: true, data: leads });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update lead status
exports.updateLeadStatus = async (req, res) => {
  try {
    const { leadId, statusName } = req.body;

    let status = await LeadStatus.findOne({ name: statusName });
    if (!status) status = await LeadStatus.create({ name: statusName });

    const lead = await Lead.findByIdAndUpdate(leadId, { status: status._id }, { new: true });
    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
