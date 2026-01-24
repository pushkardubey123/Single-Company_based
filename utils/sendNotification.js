const Notification = require("../Modals/Notification");

const sendNotification = async ({
  title,
  message,
  recipient,
  type = "custom",
  image,
  companyId,
  branchId,
  meta = {},
  isGlobal = false,
}) => {
  if (!companyId) {
    throw new Error("companyId is required for notification");
  }

  const notif = await Notification.create({
    title,
    message,
    recipient,
    type,
    image,
    companyId,
    branchId,
    meta,
    isGlobal,
  });

  return notif;
};

module.exports = sendNotification;
