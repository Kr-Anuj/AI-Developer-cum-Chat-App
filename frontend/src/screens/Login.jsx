import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../config/axios';
import { UserContext } from '../context/user.context';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { toast } from 'react-toastify';

const LoginPage = () => {
    const [step, setStep] = useState('credentials');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [countdown, setCountdown] = useState(0);
    const { setUser } = useContext(UserContext);
    const navigate = useNavigate();
    const { executeRecaptcha } = useGoogleReCaptcha();

    // Countdown Timer Logic
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    const handleCredentialsSubmit = async (e) => {
        e.preventDefault();
        if (!executeRecaptcha) {
            toast.info("reCAPTCHA is not ready yet. Please wait a moment.");
            return;
        }
        try {
            const captchaToken = await executeRecaptcha('login_password');
            await axios.post('/users/login-password', {
                email,
                password,
                captchaToken
            });
            setStep('otp');
            setCountdown(60); // Start the timer
        } catch (error) {
            toast.error(error.response?.data?.message || 'Login failed. Please check your credentials.');
        }
    };
    
    // Resend OTP Handler
    const handleResendOtp = async () => {
        if (countdown > 0  || !executeRecaptcha) return;
        try {
            // Getting a new CAPTCHA token for the resend attempt
            const captchaToken = await executeRecaptcha('login_password');

            // Sending the new CAPTCHA token with the request
            await axios.post('/users/login-password', { email, password, captchaToken });
            
            toast.success("A new OTP has been sent.");
            setCountdown(60); // Restart the timer
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to resend OTP.');
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('/users/login-otp', { email, otp });
            localStorage.setItem('token', response.data.token);
            setUser(response.data.user);
            navigate('/');
        } catch (error) {
            toast.error(error.response?.data?.message || 'OTP verification failed.');
            setStep('credentials');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">

                {step === 'credentials' ? (
                    <>
                        <h2 className="text-white text-2xl font-bold mb-6 text-center">Login</h2>
                        <form className="space-y-6" onSubmit={handleCredentialsSubmit}>
                            <div>
                                <label htmlFor="email" className="block text-gray-300 mb-2">Email</label>
                                <input
                                    onChange={(e) => setEmail(e.target.value)}
                                    value={email}
                                    type="email"
                                    id="email"
                                    name="email"
                                    className="w-full px-3 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter your email"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-gray-300 mb-2">Password</label>
                                <input
                                    onChange={(e) => setPassword(e.target.value)}
                                    value={password}
                                    type="password"
                                    id="password"
                                    name="password"
                                    className="w-full px-3 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter your password"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition duration-300"
                            >
                                Send OTP
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        <h2 className="text-white text-2xl font-bold mb-6 text-center">Enter OTP</h2>
                        <p className="text-center text-gray-400 mb-4">An OTP was sent to {email}</p>
                        <form className="space-y-6" onSubmit={handleOtpSubmit}>
                            <div>
                                <label htmlFor="otp" className="block text-gray-300 mb-2">One-Time Password</label>
                                <input
                                    onChange={(e) => setOtp(e.target.value)}
                                    value={otp}
                                    type="text"
                                    id="otp"
                                    name="otp"
                                    className="w-full px-3 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter 6-digit OTP"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition duration-300"
                            >
                                Login
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
                    Don't have an account?{' '}
                    <Link to="/register" className="text-blue-500 hover:underline">
                        Create one
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;