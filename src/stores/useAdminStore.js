import { jwtDecode } from 'jwt-decode';
import { defineStore } from 'pinia';
import { refreshAccessTokenApi } from '@/api/admin';

export const useAdminStore = defineStore('admin', {
  state: () => ({
    accessToken: '',
  }),
  persist: {
    storage: localStorage,
    pick: ['accessToken'],
  },
  getters: {
    isAuthenticated: (state) => {
      if (!state.accessToken) {
        return false;
      }

      try {
        const decodedToken = jwtDecode(state.accessToken);
        if (!decodedToken || !decodedToken.exp) {
          return false;
        }

        return decodedToken.exp * 1000 > Date.now();
      } catch (error) {
        console.error('Failed to decode JWT with jwt-decode:', error);
        return false;
      }
    },
  },
  actions: {
    async refreshAccessToken() {
      const { code, data } = await refreshAccessTokenApi();
      if (code === 'S0000') {
        const newAccessToken = data.accessToken;
        this.accessToken = newAccessToken;
        return newAccessToken;
      } else {
        throw new Error(code);
      }
    },
    logout() {
      this.$reset();
    },
  },
});
