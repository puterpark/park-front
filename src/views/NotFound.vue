<script setup>
  import { onMounted, onUnmounted } from 'vue';
  import { useRoute } from 'vue-router';

  const route = useRoute();
  const API_URL = import.meta.env.VITE_API_URL;

  const redirectUrl = () => {
    const orgUri = route.fullPath;
    const segments = orgUri.split('/').filter((p) => p !== '');
    if (segments.length === 1) {
      window.location.href = `${API_URL}${orgUri}`;
    }
  };

  const handleKeyup = (e) => {
    if (e.key === '\\') {
      redirectUrl();
    }
  };

  onMounted(() => window.addEventListener('keyup', handleKeyup));
  onUnmounted(() => window.removeEventListener('keyup', handleKeyup));
</script>

<template>
  <div class="flex min-h-screen items-center justify-center overflow-hidden">
    <div class="flex flex-col items-center justify-center pb-4">
      <img src="https://cdn.puter.us/images/apple-touch-icon.png" alt="" class="mb-8 w-16 rounded-md" />
      <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, color-mix(in srgb, var(--primary-color), transparent 60%) 10%, var(--surface-ground) 30%)">
        <div class="bg-surface-0 dark:bg-surface-900 flex w-full flex-col items-center px-8 py-20 sm:px-20" style="border-radius: 53px">
          <span class="text-primary text-3xl font-bold" @click="redirectUrl">404</span>
          <h1 class="text-surface-900 dark:text-surface-0 mb-2 text-3xl font-bold lg:text-5xl">Not Found</h1>
          <div class="text-surface-600 dark:text-surface-200 mb-8">Requested resource is not available.</div>
          <Button label="Go Back" @click="$router.back()" />
        </div>
      </div>
    </div>
  </div>
</template>
