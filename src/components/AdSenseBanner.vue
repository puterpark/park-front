<script setup>
  import { nextTick, onMounted, ref, watch } from 'vue';
  import { useRoute } from 'vue-router';

  const route = useRoute();
  const insKey = ref(0);

  const pushAd = async () => {
    insKey.value++;
    await nextTick();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}
  };

  onMounted(pushAd);
  watch(() => route.path, pushAd);
</script>

<template>
  <ins
    :key="insKey"
    class="adsbygoogle"
    style="display: inline-block; width: 320px; height: 50px"
    data-ad-client="ca-pub-8002214670454767"
    data-ad-slot="6356961766"
  />
</template>

<style scoped>
  ins.adsbygoogle[data-ad-status='unfilled'] {
    display: none !important;
  }
</style>
