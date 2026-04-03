const Permission = require("../Modals/Permission")

exports.setPermission = async(req,res)=>{
  try{
    const {employeeId, module, permissions} = req.body; 
    const data = await Permission.findOneAndUpdate(
      { companyId: req.companyId, employeeId, module },
      { permissions },
      { upsert: true, new: true }
    );
    res.json({ success: true, data });
  } catch(err){
    res.status(500).json({ message: "Server Error" });
  }
}

exports.getEmployeePermissions = async(req,res)=>{
  try{
    // ✅ Extracting employeeId from params matching the route
    const { employeeId } = req.params; 

    const permissions = await Permission.find({
      companyId: req.companyId,
      employeeId
    });

    res.json({ success: true, data: permissions });
  } catch(err){
    res.status(500).json({ message: "Server Error" });
  }
}