const Department = require("../Modals/Department");

const addDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;

    const existing = await Department.findOne({ name });
    if (existing) {
      return res.json({
        success: false,
        error: true,
        message: "Department already exists",
        code: 400,
      });
    }

    const department = new Department({ name, description });
    const result = await department.save();

    if (result) {
      res.json({
        success: true,
        error: false,
        message: "Department created successfully",
        code: 201,
        data: result,
      });
    } else {
      res.json({
        success: false,
        error: true,
        message: "Department creation failed",
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

const getDepartments = async (req, res) => {
  try {
    const data = await Department.find();
    res.json({
      success: true,
      error: false,
      message: "Departments fetched successfully",
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

const updateDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;
    const updated = await Department.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true }
    );

    if (!updated) {
      return res.json({
        success: false,
        error: true,
        message: "Department not found",
        code: 404,
      });
    }

    res.json({
      success: true,
      error: false,
      message: "Department updated successfully",
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

const deleteDepartment = async (req, res) => {
  try {
    const deleted = await Department.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.json({
        success: false,
        error: true,
        message: "Department not found",
        code: 404,
      });
    }

    res.json({
      success: true,
      error: false,
      message: "Department deleted successfully",
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
  addDepartment,
  deleteDepartment,
  updateDepartment,
  getDepartments,
};
