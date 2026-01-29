<script setup>
  import { ref } from 'vue';

  import { useBlockUi } from '@/composables/useBlockUi';

  const { isBlocked } = useBlockUi();

  const imgError = ref(false);
</script>

<template>
  <Teleport to="body">
    <div v-if="isBlocked" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <img v-if="!imgError" class="h-20 w-20 rounded-full" src="https://cdn.puter.us/images/gear.gif" alt="" @error="imgError = true" />
      <div v-else class="border-t-primary-500 h-10 w-10 animate-spin rounded-full border-4 border-neutral-200"></div>
    </div>
  </Teleport>
</template>
