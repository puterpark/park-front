<script setup>
  import { computed } from 'vue';

  import GlobalBlockUi from '@/components/GlobalBlockUi.vue';
  import { useLayout } from '@/layout/composables/layout';

  import AppFooter from './AppFooter.vue';
  import AppSidebar from './AppSidebar.vue';
  import AppTopbar from './AppTopbar.vue';

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
        <ins class="kakao_ad_area mb-4" style="display: none" data-ad-unit="DAN-AaSJlRVkpgNkrZjv" data-ad-width="320" data-ad-height="50"></ins>
        <scriptx src="//t1.daumcdn.net/kas/static/ba.min.js" async />
      </div>
      <div class="layout-main">
        <router-view />
        <div class="mt-4 flex items-center justify-center">
          <Adsense data-ad-client="ca-pub-8002214670454767" data-ad-slot="6356961766" ins-style="display: inline-block; width: 320px; height: 50px" />
        </div>
      </div>
      <AppFooter />
    </div>
    <div class="layout-mask animate-fadein" @click="hideMobileMenu" />
  </div>
  <Toast />
  <GlobalBlockUi />
</template>
