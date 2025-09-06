import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserContext } from '../context/user.context';
import axios from '../config/axios';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'; // 1. Import the hook

const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { setUser } = useContext(UserContext);
    const navigate = useNavigate();
    const { executeRecaptcha } = useGoogleReCaptcha();

    const submitHandler = async (e) => {
        e.preventDefault();

        if (!executeRecaptcha) {
            console.error("reCAPTCHA has not been loaded");
            return;
        }

        try {
            // Get the CAPTCHA token before sending the request
            const captchaToken = await executeRecaptcha('register');

            // Add the token to the payload
            const response = await axios.post('/users/register', {
                email,
                password,
                captchaToken // The backend middleware will verify this
            });

            console.log(response.data);
            localStorage.setItem('token', response.data.token);
            setUser(response.data.user);
            navigate('/');
        } catch (err) {
            // Handle errors from the API
            console.log(err.response?.data?.message || 'An error occurred');
            alert(err.response?.data?.message || 'Registration Failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
                <h2 className="text-white text-2xl font-bold mb-6 text-center">Register</h2>
                <form
                    className="space-y-6"
                    onSubmit={submitHandler}>
                    <div>
                        <label htmlFor="email" className="block text-gray-300 mb-2">Email</label>
                        <input
                            onChange={(e) => setEmail(e.target.value)}
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
                        Register
                    </button>
                </form>
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