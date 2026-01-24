const Department = require("../Modals/Department");

const addDepartment = async (req, res) => {
  try {
    const { name, description, branchId } = req.body;
    const companyId = req.companyId;

    if (!companyId || !branchId) {
      return res.status(400).json({
        success: false,
        message: "CompanyId or BranchId missing",
      });
    }

    const existing = await Department.findOne({
      name,
      companyId,
      branchId,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Department already exists in this branch",
      });
    }

    const department = await Department.create({
      name,
      description,
      companyId,
      branchId,
    });

    res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: department,
    });
  } catch (err) {
    console.error("ADD DEPARTMENT ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getDepartments = async (req, res) => {
  try {
    const { branchId } = req.query;

    const filter = {
      companyId: req.companyId, // 🔥 FIX
    };

    if (branchId) filter.branchId = branchId;

    const data = await Department.find(filter)
      .populate("branchId", "name")
      .select("name description branchId")
      .sort({ name: 1 });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getPublicDepartments = async (req, res) => {
  try {
    const { branchId } = req.query;

    const filter = {};
    if (branchId) filter.branchId = branchId;

    const data = await Department.find(filter)
      .select("_id name branchId");

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};




const updateDepartment = async (req, res) => {
  try {
    const { name, description, branchId } = req.body;
    const companyId = req.companyId;

    const updated = await Department.findOneAndUpdate(
      { _id: req.params.id, companyId },
      { name, description, branchId },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.json({
      success: true,
      message: "Department updated successfully",
      data: updated,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const companyId = req.companyId;

    const deleted = await Department.findOneAndDelete({
      _id: req.params.id,
      companyId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};



module.exports = {
  addDepartment,
  deleteDepartment,
  updateDepartment,
  getDepartments,
  getPublicDepartments
};
