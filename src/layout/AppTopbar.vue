<script setup>
  import { useLayout } from '@/composables/useLayout';
  import { useAdminStore } from '@/stores/useAdminStore';

  const { toggleMenu, toggleDarkMode, isDarkTheme } = useLayout();

  const isAuthenticated = useAdminStore().isAuthenticated;

  const logout = () => {
    useAdminStore().logout();
    window.location.href = '/';
  };
</script>

<template>
  <div class="layout-topbar">
    <div class="layout-topbar-logo-container">
      <button class="layout-menu-button layout-topbar-action" @click="toggleMenu">
        <i class="pi pi-bars"></i>
      </button>
      <router-link to="/" class="layout-topbar-logo">
        <img src="https://cdn.puter.us/images/apple-touch-icon.png" id="icon-gear" alt="" class="w-8 rounded-sm" />
        <span>PUTER.US</span>
      </router-link>
    </div>

    <div class="layout-topbar-actions">
      <div class="layout-config-menu">
        <button type="button" class="layout-topbar-action" @click="toggleDarkMode">
          <i :class="['pi', { 'pi-moon': isDarkTheme, 'pi-sun': !isDarkTheme }]"></i>
        </button>
        <button v-if="isAuthenticated" type="button" class="layout-topbar-action" @click="logout">
          <i class="pi pi-sign-out"></i>
          <span>Log Out</span>
        </button>
      </div>
    </div>
  </div>
</template>
