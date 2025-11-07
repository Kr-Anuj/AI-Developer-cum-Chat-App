import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOtpEmail = async (to, otp) => {
  try {
    await resend.emails.send({
      from: 'AI Developer <onboarding@resend.dev>',
      to,
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
    });

    console.log(`✅ OTP email sent successfully to ${to}`);
  } catch (error) {
    console.error(`❌ Error sending OTP email to ${to}:`, error);
    throw new Error('Failed to send OTP email.');
  }
};
