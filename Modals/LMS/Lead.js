const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema({
  title: { type: String, required: true },  
  description: { type: String },
  companyName: { type: String },
  contacts: [
    {
      name: String,
      email: String,
      phone: String,
      designation: String
    }
  ],
  source: { type: mongoose.Schema.Types.ObjectId, ref: "LeadSource" },
  status: { type: mongoose.Schema.Types.ObjectId, ref: "LeadStatus" },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
  estimatedValue: { type: Number },
  convertedToProject: { type: Boolean, default: false },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Lead", LeadSchema);
