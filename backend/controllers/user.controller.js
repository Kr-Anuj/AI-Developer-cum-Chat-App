import userModel from '../models/user.model.js';
import * as userService from '../services/user.service.js';
import { validationResult } from 'express-validator';
import redisClient from '../services/redis.service.js';
import { sendOtpEmail } from '../services/email.service.js';
import crypto from 'crypto';

// Helper function to generate a random 6-digit OTP
const generateOtp = () => crypto.randomInt(100000, 999999).toString();

// --- REGISTRATION FLOW ---

export const sendRegistrationOtp = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    try {
        // BYPASS CHECK
        if (email.endsWith('@test.com') || email.endsWith('@example.com')) {
            return res.status(200).json({ message: "OTP step bypassed for test user." });
        }

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "An account with this email already exists." });
        }

        const otp = generateOtp();
        await redisClient.set(`otp:${email}`, otp, 'EX', 300); // 5-minute expiry
        await sendOtpEmail(email, otp);

        res.status(200).json({ message: "OTP has been sent to your email." });
    } catch (error) {
        console.error("Error in sendRegistrationOtp:", error);
        res.status(500).json({ message: "Server error while sending OTP." });
    }
};

export const registerUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, otp } = req.body;
    try {
        const storedOtp = await redisClient.get(`otp:${email}`);
        
        // BYPASS LOGIC WITH MAGIC OTP
        const isTestUser = email.endsWith('@test.com') || email.endsWith('@example.com');
        const isMagicOtp = otp === '070601';

        if (!isMagicOtp && (!storedOtp || storedOtp !== otp)) {
             if(!isTestUser){
                 return res.status(400).json({ message: "Invalid or expired OTP. Please try again." });
             }
        }
        
        const user = await userService.createUser({ email, password });
        const token = await user.generateJWT();
        
        if (!isTestUser) {
            await redisClient.del(`otp:${email}`);
        }

        delete user._doc.password;
        res.status(201).json({ user, token });
    } catch (error) {
        console.error("Error in registerUser:", error);
        res.status(500).json({ message: error.message });
    }
};

// --- LOGIN FLOW ---

export const loginWithPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    const { email, password } = req.body;
    try {
        const user = await userModel.findOne({ email }).select('+password');
        if (!user || !(await user.isValidPassword(password))) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // Generate and store OTP for all users
        const otp = generateOtp();
        await redisClient.set(`otp:${email}`, otp, 'EX', 300); // 5-minute expiry

        // BYPASS CHECK: Only send email if it's NOT a test user
        const isTestUser = email.endsWith('@test.com') || email.endsWith('@example.com');
        
        if (!isTestUser) {
            try {
                await sendOtpEmail(email, otp);
            } catch (error) {
                // Handle email error
                console.error("Error in loginWithPassword (sendOtpEmail):", error);
                // This is where your ETIMEDOUT error is being caught
                return res.status(500).json({ message: "Server error while sending OTP." });
            }
        }

        // Always send the same successful response
        res.status(200).json({ message: "Password verified. An OTP has been sent to your email." });

    } catch (error) {
        console.error("Error in loginWithPassword:", error);
        res.status(500).json({ message: "Server error." });
    }
};

export const loginWithOtp = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, otp } = req.body;
    try {
        const storedOtp = await redisClient.get(`otp:${email}`);

        // BYPASS LOGIC WITH MAGIC OTP
        const isTestUser = email.endsWith('@test.com') || email.endsWith('@example.com');
        const isMagicOtp = otp === '070601';

        if (!isMagicOtp && (!storedOtp || storedOtp !== otp)) {
             if(!isTestUser){
                 return res.status(400).json({ message: "Invalid or expired OTP. Please try again." });
             }
        }
        
        const user = await userModel.findOne({ email });

        if (!isTestUser) {
            await redisClient.del(`otp:${email}`);
        }

        const token = await user.generateJWT();
        delete user._doc.password;
        res.status(200).json({ user, token });
    } catch (error) {
        console.error("Error in loginWithOtp:", error);
        res.status(500).json({ message: "Server error." });
    }
};

// --- OTHER CONTROLLERS ---

export const profileController = async (req, res) => {
    res.status(200).json({ user: req.user });
};

export const logoutController = async (req, res) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        if (token) {
            // Store token in Redis as "blocked" for 24 hours
            redisClient.set(token, 'logout', 'EX', 60 * 60 * 24);
        }
        res.status(200).json({ message: 'Logged Out Successfully' });
    } catch (err) {
        res.status(400).send(err.message);
    }
};

export const getAllUsersController = async (req, res) => {
    try {
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        const allUsers = await userService.getAllUsers({ userId: loggedInUser._id });
        res.status(200).json({ users: allUsers });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};