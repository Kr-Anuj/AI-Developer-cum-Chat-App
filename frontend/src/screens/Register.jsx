import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserContext } from '../context/user.context';
import axios from '../config/axios';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { toast } from 'react-toastify';

const RegisterPage = () => {
    const [step, setStep] = useState('credentials');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [countdown, setCountdown] = useState(0);
    const { setUser } = useContext(UserContext);
    const navigate = useNavigate();
    const { executeRecaptcha } = useGoogleReCaptcha();

    // --- Countdown Timer Logic ---
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        if (!executeRecaptcha) {
            toast.info("reCAPTCHA is not ready yet. Please wait a moment.");
            return;
        }
        try {
            const captchaToken = await executeRecaptcha('send_register_otp');
            await axios.post('/users/send-register-otp', {
                email,
                captchaToken
            });
            setStep('otp');
            setCountdown(60); // Start the timer
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send OTP. Please try again.');
        }
    };

    // --- Resend OTP Handler ---
    const handleResendOtp = async () => {
        if (countdown > 0 || !executeRecaptcha) return;
        try {
            //Getting a new CAPTCHA token for the resend attempt
            const captchaToken = await executeRecaptcha('send_register_otp');
            
            //sending the new CAPTCHA token with request
            await axios.post('/users/send-register-otp', { email, captchaToken });
            
            toast.success("A new OTP has been sent.");
            setCountdown(60); // Restart the timer
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to resend OTP.');
        }
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        try {
            // The final registration step still needs its own CAPTCHA check
            const captchaToken = await executeRecaptcha('register');
            const response = await axios.post('/users/register', {
                email,
                password,
                otp,
                captchaToken
            });
            
            localStorage.setItem('token', response.data.token);
            setUser(response.data.user);
            navigate('/');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Registration failed.');
            setStep('credentials');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
                
                {step === 'credentials' ? (
                    <>
                        <h2 className="text-white text-2xl font-bold mb-6 text-center">Register</h2>
                        <form className="space-y-6" onSubmit={handleEmailSubmit}>
                            <div>
                                <label htmlFor="email" className="block text-gray-300 mb-2">Email</label>
                                <input
                                    onChange={(e) => setEmail(e.target.value)}
                                    value={email}
                                    type="email"
                                    id="email"
                                    className="w-full px-3 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter your email"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition duration-300"
                            >
                                Send Verification OTP
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        <h2 className="text-white text-2xl font-bold mb-6 text-center">Create Your Account</h2>
                        <p className="text-center text-gray-400 mb-4">An OTP was sent to {email}</p>
                        <form className="space-y-6" onSubmit={handleRegisterSubmit}>
                             <div>
                                <label htmlFor="password" className="block text-gray-300 mb-2">Password</label>
                                <input
                                    onChange={(e) => setPassword(e.target.value)}
                                    value={password}
                                    type="password"
                                    id="password"
                                    className="w-full px-3 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter your password"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="otp" className="block text-gray-300 mb-2">One-Time Password</label>
                                <input
                                    onChange={(e) => setOtp(e.target.value)}
                                    value={otp}
                                    type="text"
                                    id="otp"
                                    className="w-full px-3 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter 6-digit OTP"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition duration-300"
                            >
                                Register
                            </button>
                        </form>
                        {/* --- Resend OTP UI --- */}
                        <div className="mt-4 text-center text-gray-400">
                            {countdown > 0 ? (
                                <p>Resend OTP in {countdown}s</p>
                            ) : (
                                <button onClick={handleResendOtp} className="text-blue-500 hover:underline">
                                    Resend OTP
                                </button>
                            )}
                        </div>
                    </>
                )}

                <p className="mt-4 text-center text-gray-400">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-500 hover:underline">
                        Login
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default RegisterPage;