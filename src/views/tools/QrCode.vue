<script setup>
  import QrcodeVue from 'qrcode.vue';
  import { ref } from 'vue';

  const textarea = ref('');
  const sliderValue = ref(200);
</script>
<template>
  <Fluid>
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
        <Slider v-model="sliderValue" :min="50" :max="500" :step="10" />
        <div class="flex flex-col gap-4 pt-4 md:flex-row">
          <qrcode-vue :value="textarea" :size="sliderValue" level="H" />
        </div>
      </div>
    </div>
  </Fluid>
</template>
