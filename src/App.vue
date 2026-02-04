<script setup>
  import { watchEffect } from 'vue';
  import { useLayoutStore } from '@/stores/useLayoutStore';

  const layoutStore = useLayoutStore();

  watchEffect(() => {
    if (layoutStore.isDarkTheme) {
      document.documentElement.classList.add('app-dark');
    } else {
      document.documentElement.classList.remove('app-dark');
    }
  });
</script>

<template>
  <router-view />
</template>

<style scoped></style>
