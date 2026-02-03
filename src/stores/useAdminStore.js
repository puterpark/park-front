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
    isAuthenticated: (state) => !!state.accessToken,
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
