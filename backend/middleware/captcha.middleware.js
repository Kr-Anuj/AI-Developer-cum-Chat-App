import axios from 'axios';

export const verifyCaptcha = async (req, res, next) => {
  const { captchaToken } = req.body;

  if (!captchaToken) {
    return res.status(400).json({ message: "CAPTCHA token is required." });
  }

  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`;

    const response = await axios.post(verificationUrl);
    const { success, score } = response.data;
    
    if (!success || score < 0.5) {
      // The score is between 0.0 (bot) and 1.0 (human). 0.5 is a standard threshold.
      return res.status(400).json({ message: "CAPTCHA verification failed. Please try again." });
    }

    // If verification is successful, proceed to the next middleware (the controller)
    next();

  } catch (error) {
    console.error("CAPTCHA verification error:", error);
    return res.status(500).json({ message: "Error verifying CAPTCHA." });
  }
};
