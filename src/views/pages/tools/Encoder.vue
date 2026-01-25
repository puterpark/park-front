<script setup>
  import { useAppToast } from '@/composables/useAppToast';
  import { copyText } from '@/utils/commonUtils';
  import { encoder } from '@/utils/encoder';
  import { computed, ref } from 'vue';

  const toast = useAppToast();
  const orgData = ref('');

  const convert = computed(() => {
    const text = orgData.value;
    if (!text) return { base64Encode: '', base64Decode: '', urlEncode: '', urlDecode: '', unicodeEncode: '', unicodeDecode: '' };

    const safe = (fn) => {
      try {
        return fn(text);
      } catch {
        return 'Error';
      }
    };

    return {
      base64Encode: encoder.base64.encode(text),
      base64Decode: safe(encoder.base64.decode),
      urlEncode: encoder.url.encode(text),
      urlDecode: safe(encoder.url.decode),
      unicodeEncode: encoder.unicode.encode(text),
      unicodeDecode: safe(encoder.unicode.decode),
    };
  });

  const handleCopy = async (text) => {
    const isSuccess = await copyText(text);
    if (isSuccess) {
      toast.success('클립보드에 복사되었습니다.');
    }
  };
</script>
<template>
  <Fluid>
    <div class="flex">
      <div class="card flex w-full flex-col gap-4">
        <div class="text-xl font-semibold">Encoder</div>
        <label><Tag value="입력"></Tag></label>
        <Textarea placeholder="여기에 입력하세요." rows="3" cols="30" v-model="orgData" />
        <div class="flex flex-wrap gap-4 pt-4">
          <div class="flex grow basis-0 flex-col gap-2">
            <label><Tag severity="success" value="Base64 Encode"></Tag></label>
            <Textarea rows="3" cols="30" v-model="convert.base64Encode" @click="handleCopy(convert.base64Encode)" readonly />
          </div>
          <div class="flex grow basis-0 flex-col gap-2">
            <label><Tag severity="success" value="Base64 Decode"></Tag></label>
            <Textarea rows="3" cols="30" v-model="convert.base64Decode" @click="handleCopy(convert.base64Decode)" readonly />
          </div>
        </div>
        <div class="flex flex-wrap gap-4 pt-4">
          <div class="flex grow basis-0 flex-col gap-2">
            <label><Tag severity="warn" value="URL Encode"></Tag></label>
            <Textarea rows="3" cols="30" v-model="convert.urlEncode" @click="handleCopy(convert.urlEncode)" readonly />
          </div>
          <div class="flex grow basis-0 flex-col gap-2">
            <label><Tag severity="warn" value="URL Decode"></Tag></label>
            <Textarea rows="3" cols="30" v-model="convert.urlDecode" @click="handleCopy(convert.urlDecode)" readonly />
          </div>
        </div>
        <div class="flex flex-wrap gap-4 pt-4">
          <div class="flex grow basis-0 flex-col gap-2">
            <label><Tag severity="danger" value="Unicode Encode"></Tag></label>
            <Textarea rows="3" cols="30" v-model="convert.unicodeEncode" @click="handleCopy(convert.unicodeEncode)" readonly />
          </div>
          <div class="flex grow basis-0 flex-col gap-2">
            <label><Tag severity="danger" value="Unicode Decode"></Tag></label>
            <Textarea rows="3" cols="30" v-model="convert.unicodeDecode" @click="handleCopy(convert.unicodeDecode)" readonly />
          </div>
        </div>
      </div>
    </div>
  </Fluid>
</template>
