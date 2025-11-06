const Designation = require("../Modals/Designation");

const addDesignation = async (req, res) => {
  try {
    const { name, departmentId } = req.body;

    const existing = await Designation.findOne({ name, departmentId });
    if (existing) {
      return res.json({
        success: false,
        error: true,
        message: "Designation already exists in this department",
        code: 400,
      });
    }

    const designation = new Designation({ name, departmentId });
    const result = await designation.save();

    if (result) {
      res.json({
        success: true,
        error: false,
        message: "Designation created successfully",
        code: 201,
        data: result,
      });
    } else {
      res.json({
        success: false,
        error: true,
        message: "Designation creation failed",
        code: 400,
      });
    }
  } catch {
    res.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

const getDesignations = async (req, res) => {
  try {
    const data = await Designation.find().populate("departmentId", "name");
    res.json({
      success: true,
      error: false,
      message: "Designations fetched successfully",
      code: 200,
      data,
    });
  } catch {
    res.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

const updateDesignation = async (req, res) => {
  try {
    const { name, departmentId } = req.body;

    const updated = await Designation.findByIdAndUpdate(
      req.params.id,
      { name, departmentId },
      { new: true }
    );

    if (!updated) {
      return res.json({
        success: false,
        error: true,
        message: "Designation not found",
        code: 404,
      });
    }

    res.json({
      success: true,
      error: false,
      message: "Designation updated successfully",
      code: 200,
      data: updated,
    });
  } catch {
    res.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

const deleteDesignation = async (req, res) => {
  try {
    const deleted = await Designation.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.json({
        success: false,
        error: true,
        message: "Designation not found",
        code: 404,
      });
    }

    res.json({
      success: true,
      error: false,
      message: "Designation deleted successfully",
      code: 200,
    });
  } catch {
    res.json({
      success: false,
      error: true,
      message: "Internal Server Error",
      code: 500,
    });
  }
};

module.exports = {
  addDesignation,
  getDesignations,
  updateDesignation,
  deleteDesignation,
};
