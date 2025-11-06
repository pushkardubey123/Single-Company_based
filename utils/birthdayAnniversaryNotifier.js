const cron = require("node-cron");
const User = require("../Modals/User");
const sendNotification = require("./sendNotification");

const birthdayAndAnniversaryCheck = async () => {
  try {
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    const allUsers = await User.find({ role: "employee" });

    for (const user of allUsers) {
      const dob = new Date(user.dob);
      const doj = new Date(user.doj);
      if (dob.getMonth() === todayMonth && dob.getDate() === todayDate) {
        await sendNotification({
          title: "Happy Birthday!",
          message: `Wish you a wonderful birthday, ${user.name}!`,
          recipient: user._id,
          type: "birthday",
        });
      }

      if (doj.getMonth() === todayMonth && doj.getDate() === todayDate) {
        await sendNotification({
          title: "Work Anniversary",
          message: `Congratulations on your work anniversary, ${user.name}!`,
          recipient: user._id,
          type: "anniversary",
          sendEmailFlag: true,
        });
      }
    }
  } catch (err) {
    console.error(err)
  }
};

cron.schedule("0 9 * * *", birthdayAndAnniversaryCheck);

module.exports = birthdayAndAnniversaryCheck;
