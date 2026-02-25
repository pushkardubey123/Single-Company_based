require("dotenv").config(); // Yeh line sabse upar add karein
const nodemailer = require("nodemailer");

// Ye check karne ke liye ki password aa raha hai ya nahi (Testing ke liye)
console.log("SMTP USER:", process.env.SMTP_USER); 
console.log("SMTP PASS:", process.env.SMTP_PASS ? "Loaded" : "Not Loaded");

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
});
// ... baaki ka code same rahega
const sendEmail = async (to, subject, html) => {
  try {
    // Screenshot 1 wala setup (Mail Options)
    const mailOptions = {
      from: process.env.SENDER_EMAIL, // .env se sender email aayega
      to: to,
      subject: subject,
      html: html, // Hum HTML bhej rahe hain kyunki aapka meeting template HTML hai
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email successfully sent to ${to} (Message ID: ${info.messageId})`);
    
  } catch (error) {
    console.error("❌ Email send error:", error.message);
    throw error;
  }
};

module.exports = sendEmail;