<script setup>
  import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
  import { useRoute } from 'vue-router';

  const route = useRoute();
  const insKey = ref(0);
  const visible = ref(true);
  const onFailName = `adFitOnFail_${Math.random().toString(36).slice(2)}`;

  window[onFailName] = () => {
    visible.value = false;
  };

  const requestAd = async () => {
    insKey.value++;
    visible.value = true;
    await nextTick();
    try {
      window.adfit?.();
    } catch (e) {}
  };

  onMounted(requestAd);
  watch(() => route.path, requestAd);
  onUnmounted(() => {
    delete window[onFailName];
  });
</script>

<template>
  <ins
    v-show="visible"
    :key="insKey"
    class="kakao_ad_area mb-4"
    style="display: none"
    data-ad-unit="DAN-AaSJlRVkpgNkrZjv"
    data-ad-width="320"
    data-ad-height="50"
    :data-ad-onfail="onFailName"
  />
</template>

<style scoped></style>
