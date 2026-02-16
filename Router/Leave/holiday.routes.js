const express = require("express");
const router = express.Router();
const auth = require("../../Middleware/auth"); 
const companyMiddleware = require("../../Middleware/companyMiddleware");
const { 
    getHolidays, 
    addHoliday, 
    updateHoliday, 
    deleteHoliday, 
    updateSettings // ✅ Import this
} = require("../../Controllers/Leave/HolidayController");

// Middleware to check Admin Role
const isAdmin = (req, res, next) => {
    if(req.user.role !== 'admin') return res.status(403).json({message: "Access Denied"});
    next();
};

// --- ROUTES ---

// 1. Get All Holidays
router.get("/", auth, companyMiddleware, getHolidays);

// 2. 🔥 UPDATE SETTINGS (Saturday Off Toggle)
// ⚠️ IMPORTANT: Ise '/:id' se PEHLE rakhna zaroori hai
router.put("/settings", auth, companyMiddleware, isAdmin, updateSettings);

// 3. Add Holiday
router.post("/", auth, companyMiddleware, isAdmin, addHoliday);

// 4. Update Holiday (ID based)
router.put("/:id", auth, companyMiddleware, isAdmin, updateHoliday);

// 5. Delete Holiday
router.delete("/:id", auth, companyMiddleware, isAdmin, deleteHoliday);

module.exports = router;