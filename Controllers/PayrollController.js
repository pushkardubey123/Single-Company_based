const Payroll = require("../Modals/Payroll");
const User = require("../Modals/User");
const Attendance = require("../Modals/Attendance");
const WorkFromHome = require("../Modals/WFH");
const moment = require("moment-timezone");
const CompanySettings = require("../Modals/CompanySettings");

exports.processAutoScheduledPayrolls = async () => {
    const todayDateNumber = moment().date();
    let targetMoment = moment();
    
    if (todayDateNumber <= 15) targetMoment = targetMoment.subtract(1, 'months');
    
    const targetMonthStr = targetMoment.format("YYYY-MM"); 
    const year = targetMoment.year();
    const monthNum = targetMoment.month() + 1; 
    const monthDays = new Date(year, monthNum, 0).getDate(); // 🔥 TOTAL MONTH DAYS (e.g. 30 or 31)
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    const companiesToProcess = await CompanySettings.find({ payrollGenerationDate: todayDateNumber });
    if (companiesToProcess.length === 0) return;

    for (const setting of companiesToProcess) {
        const companyId = setting.companyId;
        const employees = await User.find({ companyId, role: "employee", status: "active" });
        
        for (const emp of employees) {
            const exists = await Payroll.findOne({ employeeId: emp._id, month: targetMonthStr, companyId });
            if (exists) continue; 

            const wfhRecords = await WorkFromHome.find({
                userId: emp._id, companyId, status: "approved",
                fromDate: { $lte: endDate }, toDate: { $gte: startDate }
            });

            const attendanceRecords = await Attendance.find({
                employeeId: emp._id, date: { $gte: startDate, $lte: endDate }
            });

            let calculatedPaidDays = 0;
            let totalOTMinutes = 0;

            attendanceRecords.forEach(record => {
                const status = (record.status || "").toLowerCase();
                const remarks = (record.adminCheckoutTime || "").toLowerCase();
                const recordDate = moment(record.date);

                const isWFH = wfhRecords.some(wfh => 
                    recordDate.isSameOrAfter(moment(wfh.fromDate).startOf('day')) && 
                    recordDate.isSameOrBefore(moment(wfh.toDate).endOf('day'))
                );

                if (isWFH) calculatedPaidDays += 1;
                else if (["present", "late", "holiday", "weekly off", "wfh"].includes(status)) calculatedPaidDays += 1;
                else if (status === "half day") calculatedPaidDays += 0.5;
                else if (status === "on leave") {
                    if (remarks.includes("half")) calculatedPaidDays += 0.5;
                    // 🔥 UNPAID CHECK 🔥 (System will deduct salary if leave type contains 'unpaid', 'lop', 'loss of pay')
                    else if (!remarks.includes("unpaid") && !remarks.includes("loss of pay") && !remarks.includes("lop")) {
                        calculatedPaidDays += 1;
                    }
                }

                if (record.overtimeApproved && record.overtimeMinutes > 0) totalOTMinutes += record.overtimeMinutes;
            });

            const basicSalary = Number(emp.basicSalary || 0);
            const proratedBasic = calculatedPaidDays === 0 ? 0 : (basicSalary / monthDays) * calculatedPaidDays;

            let allowances = [];
            let totalAllowances = 0;

            if (totalOTMinutes > 0) {
                const perMinRate = basicSalary / monthDays / 8 / 60; 
                const otPay = Math.round(totalOTMinutes * perMinRate);
                allowances.push({ title: `Overtime Pay`, amount: otPay });
                totalAllowances += otPay;
            }

            const netSalary = Math.round((proratedBasic + totalAllowances) * 100) / 100;

            await Payroll.create({
                employeeId: emp._id, companyId, branchId: emp.branchId,
                month: targetMonthStr, basicSalary, allowances, deductions: [],
                workingDays: monthDays, // 🔥 FIX: Set strictly to Month Days (e.g. 30/31)
                paidDays: calculatedPaidDays, 
                netSalary, status: "Pending", generatedBy: companyId 
            });
        }
    }
};

exports.bulkGeneratePayroll = async (req, res) => {
  try {
    const { month } = req.body; 
    const companyId = req.companyId;

    if (!month) return res.status(400).json({ success: false, message: "Month is required" });

    const employees = await User.find({ companyId, role: "employee", status: "active" });
    const [yearStr, monthStr] = month.split("-");
    const year = Number(yearStr);
    const monthNum = Number(monthStr);
    const monthDays = new Date(year, monthNum, 0).getDate();
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    let generatedCount = 0;
    let skippedCount = 0;

    for (const emp of employees) {
      const exists = await Payroll.findOne({ employeeId: emp._id, month, companyId });
      if (exists) { skippedCount++; continue; }

      const wfhRecords = await WorkFromHome.find({
          userId: emp._id, companyId, status: "approved",
          fromDate: { $lte: endDate }, toDate: { $gte: startDate }
      });

      const attendanceRecords = await Attendance.find({
        employeeId: emp._id, date: { $gte: startDate, $lte: endDate }
      });

      let calculatedPaidDays = 0;
      let totalOTMinutes = 0;

      attendanceRecords.forEach(record => {
        const status = (record.status || "").toLowerCase();
        const remarks = (record.adminCheckoutTime || "").toLowerCase();
        const recordDate = moment(record.date);

        const isWFH = wfhRecords.some(wfh => 
            recordDate.isSameOrAfter(moment(wfh.fromDate).startOf('day')) && 
            recordDate.isSameOrBefore(moment(wfh.toDate).endOf('day'))
        );

        if (isWFH) calculatedPaidDays += 1;
        else if (["present", "late", "holiday", "weekly off", "wfh"].includes(status)) calculatedPaidDays += 1;
        else if (status === "half day") calculatedPaidDays += 0.5;
        else if (status === "on leave") {
            if (remarks.includes("half")) calculatedPaidDays += 0.5;
            // 🔥 UNPAID LEAVE LOGIC 🔥
            else if (!remarks.includes("unpaid") && !remarks.includes("loss of pay") && !remarks.includes("lop")) {
                calculatedPaidDays += 1; 
            }
        }

        if (record.overtimeApproved && record.overtimeMinutes > 0) totalOTMinutes += record.overtimeMinutes;
      });

      const basicSalary = Number(emp.basicSalary || 0);
      const proratedBasic = calculatedPaidDays === 0 ? 0 : (basicSalary / monthDays) * calculatedPaidDays;

      let allowances = [];
      let totalAllowances = 0;

      if (totalOTMinutes > 0) {
        const perMinRate = basicSalary / monthDays / 8 / 60; 
        const otPay = Math.round(totalOTMinutes * perMinRate);
        allowances.push({ title: `Overtime Pay`, amount: otPay });
        totalAllowances += otPay;
      }

      const netSalary = Math.round((proratedBasic + totalAllowances) * 100) / 100;

      await Payroll.create({
        employeeId: emp._id, companyId, branchId: emp.branchId,
        month, basicSalary, allowances, deductions: [],
        workingDays: monthDays, // 🔥 FIX: Total Month Days
        paidDays: calculatedPaidDays,
        netSalary, status: "Paid", 
        generatedBy: req.user._id,
      });
      generatedCount++;
    }

    return res.status(200).json({ success: true, message: `Completed! Generated: ${generatedCount}, Skipped: ${skippedCount}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.previewAutoPayroll = async (req, res) => {
  try {
    const { month } = req.body; 
    const companyId = req.companyId;

    if (!month) return res.status(400).json({ success: false, message: "Month is required (YYYY-MM)" });

    const employees = await User.find({ companyId, role: "employee", status: "active" });
    if (!employees.length) return res.status(404).json({ success: false, message: "No active employees found" });

    const [yearStr, monthStr] = month.split("-");
    const year = Number(yearStr);
    const monthNum = Number(monthStr);
    const monthDays = new Date(year, monthNum, 0).getDate();
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    let previewData = [];

    for (const emp of employees) {
      const exists = await Payroll.findOne({ employeeId: emp._id, month, companyId });
      
      const wfhRecords = await WorkFromHome.find({
          userId: emp._id, companyId, status: "approved",
          fromDate: { $lte: endDate }, toDate: { $gte: startDate }
      });

      const attendanceRecords = await Attendance.find({
        employeeId: emp._id, date: { $gte: startDate, $lte: endDate }
      });

      let calculatedPaidDays = 0;
      let totalOTMinutes = 0;

      attendanceRecords.forEach(record => {
        const status = (record.status || "").toLowerCase();
        const remarks = (record.adminCheckoutTime || "").toLowerCase();
        const recordDate = moment(record.date);

        const isWFH = wfhRecords.some(wfh => 
            recordDate.isSameOrAfter(moment(wfh.fromDate).startOf('day')) && 
            recordDate.isSameOrBefore(moment(wfh.toDate).endOf('day'))
        );

        if (isWFH) calculatedPaidDays += 1;
        else if (["present", "late", "holiday", "weekly off", "wfh"].includes(status)) calculatedPaidDays += 1;
        else if (status === "half day") calculatedPaidDays += 0.5;
        else if (status === "on leave") {
            if (remarks.includes("half")) calculatedPaidDays += 0.5;
            // 🔥 UNPAID LEAVE LOGIC 🔥
            else if (!remarks.includes("unpaid") && !remarks.includes("loss of pay") && !remarks.includes("lop")) {
                calculatedPaidDays += 1; 
            }
        }

        if (record.overtimeApproved && record.overtimeMinutes > 0) totalOTMinutes += record.overtimeMinutes;
      });

      const basicSalary = Number(emp.basicSalary || 0);
      const proratedBasic = calculatedPaidDays === 0 ? 0 : (basicSalary / monthDays) * calculatedPaidDays;

      let allowances = [];
      let totalAllowances = 0;

      if (totalOTMinutes > 0) {
        const perMinRate = basicSalary / monthDays / 8 / 60; 
        const otPay = Math.round(totalOTMinutes * perMinRate);
        allowances.push({ title: `Overtime Pay`, amount: otPay });
        totalAllowances += otPay;
      }

      const netSalary = Math.round((proratedBasic + totalAllowances) * 100) / 100;

      previewData.push({
        employeeId: emp._id, name: emp.name, basicSalary,
        workingDays: monthDays, // 🔥 FIX
        paidDays: calculatedPaidDays, otMinutes: totalOTMinutes,
        allowances, netSalary, alreadyGenerated: !!exists 
      });
    }

    return res.status(200).json({ success: true, data: previewData });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error during preview" });
  }
};

exports.assignPayroll = async (req, res) => {
    try {
        const payroll = await Payroll.findOne({ _id: req.params.id, companyId: req.companyId });
        if (!payroll) return res.status(404).json({ success: false, message: "Not found" });
        payroll.status = "Paid"; 
        await payroll.save();
        return res.status(200).json({ success: true, message: "Assigned Successfully!" });
    } catch (error) { return res.status(500).json({ success: false }); }
};

exports.createPayroll = async (req, res) => {
  try {
    const { employeeId, month, basicSalary, allowances = {}, deductions = {}, workingDays, paidDays } = req.body;

    const employee = await User.findById(employeeId).select("companyId branchId basicSalary");
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    const existingPayroll = await Payroll.findOne({ employeeId, month, companyId: employee.companyId });
    if (existingPayroll) {
      return res.status(400).json({ success: false, message: `Payroll for ${month} already exists! Please update the existing record.` });
    }

    let finalBasicSalary = Number(basicSalary) || Number(employee.basicSalary || 0);
    const totalAllowances = Object.values(allowances).reduce((a, b) => a + Number(b || 0), 0);
    const totalDeductions = Object.values(deductions).reduce((a, b) => a + Number(b || 0), 0);
    const paidDaysNum = Number(paidDays || 0);

    let monthDays = 30;
    if (month && month.includes("-")) {
      const [yStr, mStr] = month.split("-");
      monthDays = new Date(Number(yStr), Number(mStr), 0).getDate();
    }

    const proratedBasic = paidDaysNum === 0 ? 0 : (finalBasicSalary / monthDays) * paidDaysNum;
    const netSalary = Math.round((proratedBasic + totalAllowances - totalDeductions + Number.EPSILON) * 100) / 100;

    const payroll = await Payroll.create({
      employeeId, companyId: employee.companyId, branchId: employee.branchId,
      month, basicSalary: finalBasicSalary, allowances, deductions,
      workingDays: monthDays, // 🔥 FIX
      paidDays, netSalary, status: "Paid",
      generatedBy: req.user._id,
    });

    return res.status(201).json({ success: true, message: "Payroll generated successfully", data: payroll });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.updatePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!payroll) return res.status(404).json({ success: false, message: "Payroll not found" });

    const { allowances = payroll.allowances, deductions = payroll.deductions, workingDays, paidDays, basicSalary } = req.body;

    const totalAllowances = Array.isArray(allowances) ? allowances.reduce((a, b) => a + Number(b.amount || 0), 0) : 0;
    const totalDeductions = Array.isArray(deductions) ? deductions.reduce((a, b) => a + Number(b.amount || 0), 0) : 0;
    
    payroll.basicSalary = basicSalary || payroll.basicSalary;
    payroll.allowances = allowances;
    payroll.deductions = deductions;
    payroll.workingDays = workingDays !== undefined ? workingDays : payroll.workingDays;
    payroll.paidDays = paidDays !== undefined ? paidDays : payroll.paidDays;

    const monthDays = payroll.month.includes("-") ? new Date(Number(payroll.month.split("-")[0]), Number(payroll.month.split("-")[1]), 0).getDate() : 30;
    const proratedBasic = (payroll.basicSalary / monthDays) * payroll.paidDays;
    payroll.netSalary = Math.round((proratedBasic + totalAllowances - totalDeductions + Number.EPSILON) * 100) / 100;

    await payroll.save();
    return res.status(200).json({ success: true, message: "Payroll updated successfully", data: payroll });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.getAllPayrolls = async (req, res) => {
  try {
    const filter = { companyId: req.companyId, ...(req.query.branchId && { branchId: req.query.branchId }) };
    const payrolls = await Payroll.find(filter)
      .populate({ path: "employeeId", select: "name employeeCode departmentId", populate: { path: "departmentId", select: "name" } })
      .populate("branchId", "name").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: payrolls });
  } catch (error) { return res.status(500).json({ success: false, message: "Failed to fetch payrolls" }); }
};

exports.getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate({ path: "employeeId", select: "name departmentId", populate: { path: "departmentId", select: "name" } }).populate("branchId", "name");
    if (!payroll) return res.status(404).json({ success: false, message: "Payroll not found" });
    return res.status(200).json({ success: true, data: payroll });
  } catch (error) { return res.status(500).json({ success: false, message: "Failed to fetch payroll" }); }
};

exports.getPayrollByEmployeeId = async (req, res) => {
  try {
    const filter = { employeeId: req.params.id, companyId: req.companyId };
    if (req.query.month) filter.month = req.query.month;
    const payrolls = await Payroll.find(filter)
      .populate({ path: "employeeId", select: "name employeeCode departmentId", populate: { path: "departmentId", select: "name" } })
      .populate("branchId", "name").sort({ month: -1 });
    return res.status(200).json({ success: true, data: payrolls });
  } catch (error) { return res.status(500).json({ success: false, message: "Failed to fetch employee payrolls" }); }
};

exports.getMyPayrolls = async (req, res) => {
  try {
    const payrolls = await Payroll.find({ employeeId: req.user._id, companyId: req.companyId })
      .populate({ path: "employeeId", select: "name departmentId designationId pan bankAccount", populate: [{ path: "departmentId", select: "name" }, { path: "designationId", select: "name" }] });
    return res.status(200).json({ success: true, data: payrolls });
  } catch (error) { return res.status(500).json({ success: false, message: "Failed to fetch my payrolls" }); }
};

exports.deletePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!payroll) return res.status(404).json({ success: false, message: "Payroll not found" });
    return res.status(200).json({ success: true, message: "Payroll deleted successfully" });
  } catch (error) { return res.status(500).json({ success: false, message: "Failed to delete payroll" }); }
};