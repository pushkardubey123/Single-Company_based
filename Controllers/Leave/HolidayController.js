const Holiday = require("../../Modals/Leave/Holiday");
const LeaveSettings = require("../../Modals/Leave/LeaveSettings");
const moment = require("moment");

// --- 1. MANAGE SETTINGS (Toggle Saturday) ---
exports.updateSettings = async (req, res) => {
    try {
        const { isSaturdayOff } = req.body;
        // Upsert (Update if exists, else Insert)
        const settings = await LeaveSettings.findOneAndUpdate(
            { companyId: req.companyId },
            { isSaturdayOff },
            { new: true, upsert: true }
        );
        res.json({ success: true, message: "Settings Updated", data: settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// --- 2. ADD HOLIDAY (Supports Range) ---
exports.addHoliday = async (req, res) => {
  try {
    const { name, startDate, endDate, isOptional } = req.body;
    
    // Agar user ne sirf ek date dali, to start=end same kar do
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : start; 

    if (!name || !start) {
      return res.status(400).json({ success: false, message: "Name and Start Date required" });
    }

    const holiday = await Holiday.create({
      companyId: req.companyId,
      name,
      startDate: start,
      endDate: end,
      isOptional: !!isOptional
    });

    res.status(201).json({ success: true, message: "Holiday Added", data: holiday });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to add holiday" });
  }
};

// --- 3. GET HOLIDAYS ---
exports.getHolidays = async (req, res) => {
    // ... logic to fetch holidays (same as before but returns ranges)
    // Settings bhi bhej dena taaki Frontend ko pata ho Saturday off hai ya nahi
    const settings = await LeaveSettings.findOne({ companyId: req.companyId });
    const holidays = await Holiday.find({ companyId: req.companyId }).sort({startDate: 1});
    
    res.json({ 
        success: true, 
        data: { 
            holidays, 
            settings: settings || { isSaturdayOff: true } 
        } 
    });
};

// Update/Delete same rahenge (bas fields update kar lena)

// --- UPDATE HOLIDAY (Admin Only) ---
exports.updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, isOptional } = req.body;

    const holiday = await Holiday.findOne({ _id: id, companyId: req.companyId });
    if (!holiday) return res.status(404).json({ message: "Not Found" });

    if (name) holiday.name = name;
    if (date) {
        holiday.date = date;
        holiday.day = moment(date).format('dddd');
    }
    if (isOptional !== undefined) holiday.isOptional = isOptional;

    await holiday.save();
    res.json({ success: true, message: "Updated Successfully", data: holiday });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- DELETE HOLIDAY (Admin Only) ---
exports.deleteHoliday = async (req, res) => {
  try {
    await Holiday.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    res.json({ success: true, message: "Deleted Successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};