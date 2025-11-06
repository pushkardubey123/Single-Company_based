const Notification = require("../Modals/Notification");

const sendNotification = async ({
  title,
  message,
  recipient,
  type = "custom",
  image,
}) => {
  const notif = new Notification({ title, message, recipient, type, image });
  await notif.save();
  return notif;
};

module.exports = sendNotification;
