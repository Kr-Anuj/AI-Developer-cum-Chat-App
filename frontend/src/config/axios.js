import axios from "axios";

// Create an instance without the Authorization header.
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Use an interceptor to add the token to every request.
axiosInstance.interceptors.request.use(
  (config) => {
    // Get the token from localStorage.
    const token = localStorage.getItem("token");

    // If the token exists, add it to the Authorization header.
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config; // Continue with the request.
  },
  (error) => {
    // Handle request errors.
    return Promise.reject(error);
  }
);

export default axiosInstance;
