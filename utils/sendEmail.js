const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // 465 ke liye true
      pool: true,   // Connection drops ko bypass karne ke liye
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Aapka 16-digit App Password
      },
      tls: {
        rejectUnauthorized: false // Cloud server ke SSL/TLS block ko bypass karne ke liye
      }
    });

    const mailOptions = {
      from: `"HRMS App" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to ${to}, Message ID: ${info.messageId}`);
    return info;
    
  } catch (err) {
    console.error("Email send error (Nodemailer):", err.message);
    // Error throw kar rahe hain taaki logs mein poora trace dikhe
    throw err; 
  }
};

module.exports = sendEmail;