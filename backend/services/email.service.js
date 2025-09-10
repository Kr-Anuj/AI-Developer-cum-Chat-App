import nodemailer from 'nodemailer';

// Create a transporter object using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

export const sendOtpEmail = async (to, otp) => {
  const mailOptions = {
    from: `"AI Developer cum Chat App" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: 'Your One-Time Password (OTP)',
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
        <h2>Verification Code</h2>
        <p>Here is your one-time password to complete your action:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; background: #f2f2f2; padding: 10px 20px; border-radius: 5px; display: inline-block;">
          ${otp}
        </p>
        <p>This OTP is valid for 5 minutes.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${to}`);
  } catch (error) {
    console.error(`Error sending OTP email to ${to}:`, error);
    throw new Error('Failed to send OTP email.');
  }
};