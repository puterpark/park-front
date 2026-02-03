import axios from 'axios';

import { API_URI } from '@/api/apiUri';
import { useAdminStore } from '@/stores/useAdminStore';

export const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const adminStore = useAdminStore();
    const accessToken = adminStore.accessToken;

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  async (response) => {
    return response.data;
  },
  async (error) => {
    const { response, config } = error;
    if (response) {
      const { data } = response;
      const { code } = data;

      const adminStore = useAdminStore();

      // token 인증 실패, refreshToken 만료
      if (['F0007', 'F0009'].includes(code)) {
        adminStore.logout();
        window.location.href = '/admin';
        return new Promise(() => {});
      }

      // accessToken 만료
      if (code === 'F0006') {
        if (config.url.includes(API_URI.ADMIN.REFRESH)) {
          adminStore.logout();
          window.location.href = '/admin';
          return new Promise(() => {});
        }

        try {
          const accessToken = await adminStore.refreshAccessToken();
          config.headers.Authorization = `Bearer ${accessToken}`;
          return api(config);
        } catch (refreshError) {
          adminStore.logout();
          window.location.href = '/admin';
          return new Promise(() => {});
        }
      }

      return data;
    } else {
      return {
        code: 'E0001',
        data: null,
      };
    }
  }
);

export default api;
