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
  host: "smtp.gmail.com",
  port: 587, // Port change karke 587 karein
  secure: false, // 587 ke liye yeh hamesha false rahega
  requireTLS: true, // TLS forcefully enable karein
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    ciphers: "SSLv3",
    rejectUnauthorized: false // Cloud server network issues bypass karne ke liye
  }
});

    const mailOptions = {
      from: `"${senderName}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      attachments,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to ${to}`); // Success log add kar diya
    
  } catch (err) {
    console.error("Email send error:", err.message);
    throw err;
  }
};

module.exports = sendEmail;