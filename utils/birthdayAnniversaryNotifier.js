const cron = require("node-cron");
const User = require("../Modals/User");
const sendNotification = require("./sendNotification");

const birthdayAndAnniversaryCheck = async () => {
  try {
    const today = new Date();
    const m = today.getMonth();
    const d = today.getDate();

    const users = await User.find({
      role: "employee",
      companyId: { $exists: true },
    });

    for (const user of users) {
      const dob = new Date(user.dob);
      const doj = new Date(user.doj);

      if (dob.getMonth() === m && dob.getDate() === d) {
        await sendNotification({
          title: "Happy Birthday 🎉",
          message: `Wish you a wonderful birthday, ${user.name}!`,
          recipient: user._id,
          type: "birthday",
          companyId: user.companyId,
          branchId: user.branchId,
        });
      }

      if (doj.getMonth() === m && doj.getDate() === d) {
        await sendNotification({
          title: "Work Anniversary 🎊",
          message: `Congratulations on your work anniversary, ${user.name}!`,
          recipient: user._id,
          type: "anniversary",
          companyId: user.companyId,
          branchId: user.branchId,
        });
      }
    }
  } catch (err) {
    console.error("Birthday Cron Error:", err);
  }
};

cron.schedule("0 9 * * *", birthdayAndAnniversaryCheck);
module.exports = birthdayAndAnniversaryCheck;
