<script setup>
  import { useSeo } from '@/composables/useSeo';
  import QrcodeVue from 'qrcode.vue';
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

  useSeo('입력한 문자열로 QR코드를 생성해 URL를 입력하여 짧은 링크(shortenURL)를 생성해 보세요.', 'QRCode, QR코드, QRCode Generate, QRCode generator, QR코드 생성기, QR코드 생성');

  const textarea = ref('');
  const sliderValue = ref(200);

  const windowWidth = ref(window.innerWidth);

  const updateWidth = () => {
    windowWidth.value = window.innerWidth;
  };

  onMounted(() => window.addEventListener('resize', updateWidth));
  onUnmounted(() => window.removeEventListener('resize', updateWidth));

  const sliderMaxValue = computed(() => {
    const value = Math.min(windowWidth.value - 115, 500);
    return value < 5 ? 5 : value;
  });

  watch(sliderMaxValue, (newMax) => {
    if (sliderValue.value > newMax) {
      sliderValue.value = newMax;
    }
  });
</script>
<template>
  <div class="flex">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">QR Code</div>
      <div>
        <Tag value="입력" />
      </div>
      <Textarea id="textarea" placeholder="여기에 입력하세요." :autoResize="true" rows="3" cols="30" v-model="textarea" />
    </div>
  </div>
  <div class="mt-8 flex" v-if="textarea">
    <div class="card flex w-full flex-col gap-4">
      <InputText v-model.number="sliderValue" readonly />
      <Slider v-model="sliderValue" :min="50" :max="sliderMaxValue" :step="10" />
      <div class="flex max-w-fit flex-col gap-4 pt-4">
        <qrcode-vue :value="textarea" :size="sliderValue" level="H" />
      </div>
    </div>
  </div>
</template>
