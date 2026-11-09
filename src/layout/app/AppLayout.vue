<script setup>
  import { computed } from 'vue';
  import AdFitBanner from '@/components/AdFitBanner.vue';
  import AdSenseBanner from '@/components/AdSenseBanner.vue';
  import GlobalBlockUi from '@/components/GlobalBlockUi.vue';
  import { useLayout } from '@/composables/useLayout';
  import AppFooter from '../AppFooter.vue';
  import AppTopbar from '../AppTopbar.vue';
  import AppSidebar from './AppSidebar.vue';

  const { layoutConfig, layoutState, hideMobileMenu } = useLayout();

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
    <AppSidebar />
    <div class="layout-main-container">
      <div class="flex items-center justify-center">
        <AdFitBanner />
      </div>
      <div class="layout-main">
        <router-view />
        <div class="mt-4 flex items-center justify-center">
          <AdSenseBanner />
        </div>
      </div>
      <AppFooter />
    </div>
    <div class="layout-mask animate-fadein" @click="hideMobileMenu" />
  </div>
  <Toast />
  <GlobalBlockUi />
</template>
