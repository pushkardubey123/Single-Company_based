const nodemailer = require("nodemailer");

const sendEmail = async (
  to,
  subject,
  html,
  attachments = [],
  senderName = process.env.EMAIL_USER
) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"${senderName}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      attachments,
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Email send error:", err.message);
    throw err;
  }
};

module.exports = sendEmail;
