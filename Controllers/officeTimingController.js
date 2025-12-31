const OfficeTiming = require("../Modals/OfficeTiming");

/* ================= SAVE / UPDATE ================= */
exports.saveTiming = async (req, res) => {
  try {
    const { branchId, officeStart, officeEnd } = req.body;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Branch is required",
      });
    }

    const timing = await OfficeTiming.findOneAndUpdate(
      {
        companyId: req.companyId,
        branchId: branchId,
      },
      {
        officeStart,
        officeEnd,
      },
      {
        upsert: true,
        new: true,
      }
    );

    res.json({
      success: true,
      message: "Office timing saved successfully",
      data: timing,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* ================= GET (BRANCH WISE) ================= */
exports.getTiming = async (req, res) => {
  try {
    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Branch is required",
      });
    }

    const timing = await OfficeTiming.findOne({
      companyId: req.companyId,
      branchId,
    });

    res.json({
      success: true,
      data: timing,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
