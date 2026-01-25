<script setup>
  import QrcodeVue from 'qrcode.vue';
  import { ref } from 'vue';

  const textarea = ref('');
</script>
<template>
  <Fluid>
    <div class="flex">
      <div class="card flex w-full flex-col gap-4">
        <div class="text-xl font-semibold">QR Code</div>
        <label for="textarea"><Tag value="입력"></Tag></label>
        <Textarea id="textarea" placeholder="여기에 입력하세요." :autoResize="true" rows="3" cols="30" v-model="textarea" />
      </div>
    </div>
    <div class="mt-8 flex" v-if="textarea">
      <div class="card flex w-full flex-col gap-4">
        <div class="flex flex-col gap-4 md:flex-row">
          <qrcode-vue :value="textarea" :size="200" level="H" />
        </div>
      </div>
    </div>
  </Fluid>
</template>
