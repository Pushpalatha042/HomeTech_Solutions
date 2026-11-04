import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('hometech_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If unauthorized and has stored session, clean up
      if (localStorage.getItem('hometech_token')) {
        console.warn('Session expired or unauthorized. Logging out.');
        localStorage.removeItem('hometech_token');
        localStorage.removeItem('hometech_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
