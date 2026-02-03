<script setup>
  import { computed } from 'vue';

  import GlobalBlockUi from '@/components/GlobalBlockUi.vue';
  import { useLayout } from '@/composables/useLayout';
  import AppFooter from '@/layout/AppFooter.vue';
  import AppTopbar from '@/layout/AppTopbar.vue';
  import AdminSidebar from '@/layout/admin/AdminSidebar.vue';

  const { layoutConfig, layoutState } = useLayout();

  const containerClass = computed(() => {
    return {
      'layout-overlay': layoutConfig.menuMode === 'overlay',
      'layout-static': layoutConfig.menuMode === 'static',
      'layout-overlay-active': layoutState.overlayMenuActive,
      'layout-mobile-active': layoutState.mobileMenuActive,
      'layout-static-inactive': layoutState.staticMenuInactive,
    };
  });
</script>

<template>
  <div class="layout-wrapper" :class="containerClass">
    <AppTopbar />
    <AdminSidebar />
    <div class="layout-main-container">
      <div class="layout-main">
        <router-view />
      </div>
      <AppFooter />
    </div>
  </div>
  <Toast />
  <GlobalBlockUi />
</template>
