import { defineStore } from 'pinia';

export const useLayoutStore = defineStore('layout', {
  state: () => ({
    isDarkTheme: false,
  }),
  persist: {
    storage: localStorage,
    pick: ['isDarkTheme'],
  },
  actions: {
    toggleDarkMode() {
      this.isDarkTheme = !this.isDarkTheme;
    },
  },
});
