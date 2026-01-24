const attendanceTbl = require("../Modals/Attendence");
const mongoose = require("mongoose");
const moment = require("moment");

// --- GET TIMESHEET REPORT ---
const getTimesheetReport = async (req, res) => {
    try {
        const { startDate, endDate, employee } = req.query;
        const filter = { companyId: req.companyId };

        if (startDate && endDate) {
            filter.date = { 
                $gte: new Date(startDate), 
                $lte: new Date(new Date(endDate).setHours(23, 59, 59)) 
            };
        }

        if (employee && employee !== "all") {
            filter.employeeId = employee;
        }

const records = await attendanceTbl.find(filter)
            .populate("employeeId", "name email")
            .populate("branchId", "name")
            .sort({ date: -1 });

        const result = records.map(r => {
            const totalMins = r.workedMinutes || 0;
            const otMins = r.overtimeMinutes || 0;
            
            // --- LOGIC CORRECTION ---
            // Regular Time = Total - OT
            // Agar galti se OT > Total ho jaye (DB corruption), to Regular = 0 maano
            let regularMins = totalMins - otMins;
            if (regularMins < 0) regularMins = 0;

            // Payable OT (Sirf approved wala)
            const payableOtMins = r.overtimeApproved ? otMins : 0;
            const totalPayableMins = regularMins + payableOtMins;

            return {
                _id: r._id,
                date: r.date,
                employee: r.employeeId,
                branch: r.branchId?.name || "Main",
                status: r.status,
                
                regularHours: (regularMins / 60).toFixed(2), 
                otHours: (otMins / 60).toFixed(2),
                
                isOtApproved: r.overtimeApproved,
                
                // Payroll ke liye final hours
                totalPayableHours: (totalPayableMins / 60).toFixed(2),
                
                hasMissingCheckout: r.inOutLogs.some(l => !l.outTime)
            };
        });

        res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error("Timesheet Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
const getEmployeeTimesheet = async (req, res) => {
  try {
    const { id } = req.params;

    // --- SECURITY CHECK ---
    if (req.user.role !== "admin" && req.user._id.toString() !== id) {
      return res.status(403).json({ 
        success: false, 
        message: "Access Denied: You can only view your own timesheets." 
      });
    }

    // --- FETCH DATA (Corrected Model Name) ---
    // Change 'Timesheet.find' to 'attendanceTbl.find'
    const records = await attendanceTbl.find({ employeeId: id })
      .populate("employeeId", "name email")
      .sort({ date: -1 });

    // --- Format Data (Jaisa getTimesheetReport mein kiya tha) ---
    const formattedData = records.map(r => {
        const totalMins = r.workedMinutes || 0;
        const otMins = r.overtimeMinutes || 0;
        let regularMins = totalMins - otMins;
        if (regularMins < 0) regularMins = 0;

        const payableOtMins = r.overtimeApproved ? otMins : 0;
        const totalPayableMins = regularMins + payableOtMins;

        return {
            _id: r._id,
            date: r.date,
            hours: (totalMins / 60).toFixed(2), // Total logged hours
            regularHours: (regularMins / 60).toFixed(2),
            otHours: (otMins / 60).toFixed(2),
            totalPayableHours: (totalPayableMins / 60).toFixed(2),
            remark: r.remark || (r.status === 'Absent' ? 'Leave/Absent' : ''),
            status: r.status
        };
    });

    res.status(200).json({ success: true, data: formattedData });

  } catch (error) {
    console.error("Error fetching timesheet:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

module.exports = { getTimesheetReport, getEmployeeTimesheet };