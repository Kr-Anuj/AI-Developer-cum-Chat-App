import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { body } from "express-validator";
import * as authMiddleware from '../middleware/auth.middleware.js';
import { verifyCaptcha } from '../middleware/captcha.middleware.js';

const router = Router();

// --- REGISTRATION FLOW ---
// Step 1: User provides email and solves CAPTCHA and then we send OTP.
router.post('/send-register-otp',
    verifyCaptcha,
    body('email').isEmail().withMessage('A valid email is required'),
    userController.sendRegistrationOtp
);

// Step 2: User provides details + OTP to complete registration.
router.post('/register',
    body('email').isEmail().withMessage('Email must be a valid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    userController.registerUser
);


// --- LOGIN FLOW ---
// Step 1: User provides credentials + CAPTCHA. If correct then we send an OTP.
router.post('/login-password',
    verifyCaptcha,
    body('email').isEmail().withMessage('Email must be a valid email address'),
    body('password').notEmpty().withMessage('Password is required'),
    userController.loginWithPassword
);

// Step 2: User provides email + OTP to get their session token.
router.post('/login-otp',
    body('email').isEmail().withMessage('Email is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    userController.loginWithOtp
);

// --- PASSWORD RESET FLOW ---
// Step 1: User provides email + CAPTCHA to request a reset OTP
router.post('/send-reset-otp',
    verifyCaptcha,
    body('email').isEmail().withMessage('A valid email is required'),
    userController.sendResetOtp
);

// Step 2: User provides email, OTP, and new password to reset
router.post('/reset-password',
    body('email').isEmail().withMessage('Email is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
    userController.resetPassword
);

router.get('/profile', authMiddleware.authUser, userController.profileController);
router.get('/logout', authMiddleware.authUser, userController.logoutController);
router.get('/all', authMiddleware.authUser, userController.getAllUsersController);

export default router;