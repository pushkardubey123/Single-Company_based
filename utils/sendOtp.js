const nodemailer = require("nodemailer");

const sendOTP = async (email, otp) => {
  try {
    // Gmail SMTP Transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // your Gmail address
        pass: process.env.EMAIL_PASS, // 16-character App Password (not your normal password)
      },
    });

    // Email content
    const mailOptions = {
      from: `"HRMS App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>🔐 Password Reset Request</h2>
          <p>Your One-Time Password (OTP) is:</p>
          <h1 style="color: #2c3e50;">${otp}</h1>
          <p>This OTP will expire in <b>10 minutes</b>.</p>
          <hr/>
          <p>If you didn’t request this, please ignore this email.</p>
        </div>
      `,
    };

    // Send mail
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP sent successfully to ${email}`);
  } catch (error) {
    console.error("❌ Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};

module.exports = sendOTP;
