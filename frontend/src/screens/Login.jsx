import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../config/axios'
import { UserContext } from '../context/user.context';

const LoginPage = () => {
    const[email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const { setUser } = useContext(UserContext)
    const navigate = useNavigate()
    function submitHandler(e) {
        e.preventDefault()
        axios.post('/users/login', {
            email,
            password
        }).then((res) => {
            console.log(res.data)
            localStorage.setItem('token', res.data.token)
            setUser(res.data.user)
            navigate('/')
        }).catch((err) => {
            console.log(err.response.data)
        })
    }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-white text-2xl font-bold mb-6 text-center">Login</h2>
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
            Login
          </button>
        </form>
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
