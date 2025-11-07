import axios from "axios";

/**
 * Sends a One-Time Password (OTP) email using Brevo's transactional email API.
 *
 * @param {string} to - The recipient email address.
 * @param {string} otp - The OTP code to send.
 */
export const sendOtpEmail = async (to, otp) => {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "AI Developer cum Chat App",
          email: "sahavanujjurel53544@gmail.com", // Use the verified Gmail sender
        },
        to: [{ email: to }],
        subject: "Your One-Time Password (OTP)",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
            <h2>Verification Code</h2>
            <p>Here is your one-time password to complete your action:</p>
            <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; background: #f2f2f2; padding: 10px 20px; border-radius: 5px; display: inline-block;">
              ${otp}
            </p>
            <p>This OTP is valid for 5 minutes.</p>
          </div>
        `,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ OTP email sent successfully to ${to}`);
    console.log("📬 Brevo message ID:", response.data.messageId);
  } catch (error) {
    console.error(
      `❌ Error sending OTP email to ${to}:`,
      error.response?.data || error.message
    );
    throw new Error("Failed to send OTP email.");
  }
};
