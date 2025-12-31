const Designation = require("../Modals/Designation");

const addDesignation = async (req, res) => {
  try {
    const { name, branchId, departmentId } = req.body;

    if (!name || !branchId || !departmentId) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const designation = await Designation.create({
      name,
      branchId,
      departmentId,
      companyId: req.companyId, // 🔥 FIX
    });

    res.status(201).json({
      success: true,
      message: "Designation created",
      data: designation,
    });
  } catch (err) {
    console.error("ADD DESIGNATION ERROR:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


const getDesignations = async (req, res) => {
  try {
    const { branchId, departmentId } = req.query;

    const filter = {
      companyId: req.companyId, // 🔥 MOST IMPORTANT
    };

    if (branchId) filter.branchId = branchId;
    if (departmentId) filter.departmentId = departmentId;

    const data = await Designation.find(filter)
      .populate("branchId", "name")
      .populate("departmentId", "name")
      .select("name branchId departmentId")
      .sort({ name: 1 });

    res.json({ success: true, data });
  } catch (err) {
    console.error("GET DESIGNATION ERROR:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


const updateDesignation = async (req, res) => {
  try {
    const updated = await Designation.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.companyId, // 🔥 security
      },
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Designation not found",
      });
    }

    res.json({
      success: true,
      message: "Designation updated",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};



const deleteDesignation = async (req, res) => {
  try {
    const deleted = await Designation.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId, // 🔥 security
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Designation not found",
      });
    }

    res.json({
      success: true,
      message: "Designation deleted",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getPublicDesignations = async (req, res) => {
  try {
    const { companyId, branchId, departmentId } = req.query;

    const filter = {};
    if (companyId) filter.companyId = companyId;
    if (branchId) filter.branchId = branchId;
    if (departmentId) filter.departmentId = departmentId;

    const data = await Designation.find(filter)
      .select("_id name departmentId");

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


module.exports = {
  addDesignation,
  getDesignations,
  updateDesignation,
  deleteDesignation,
  getPublicDesignations
};
