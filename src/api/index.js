import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use();
api.interceptors.response.use(
  async (response) => {
    return response.data;
  },
  async (error) => {
    const { data } = error.response;
    return data;
  }
);

export default api;
