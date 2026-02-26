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
      service: "gmail", // Seedha Gmail service use karein
      host: "smtp.gmail.com",
      port: 465, // 465 port Render par safely kaam karta hai
      secure: true, // Port 465 ke liye ye true hona zaroori hai
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Dhyan rahe ye 16-digit App Password ho
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
    console.log(`Email successfully sent to ${to}`); // Success log add kar diya
    
  } catch (err) {
    console.error("Email send error:", err.message);
    throw err;
  }
};

module.exports = sendEmail;