<script setup>
  import { computed, ref } from 'vue';
  import { useAppToast } from '@/composables/useAppToast';
  import { useSeo } from '@/composables/useSeo';
  import { copyText } from '@/utils/commonUtils';
  import { encoder } from '@/utils/encoder';

  useSeo({
    title: 'Encoder',
    description: '입력한 문자열을 다양하게 인코딩 또는 디코딩해 URL를 입력하여 짧은 링크(shortenURL)를 생성해 보세요.',
    keywords:
      'Encode, Decode, Base64, Base64 인코딩, Base64 디코딩, Base64 Encode, Base64 Decode, URL 인코딩, URL 디코딩, Url Encode, Url Decode, Unicode, 유니코드, Unicode 인코딩, Unicode 디코딩, Unicode Encode, Unicode Decode, 유니코드 인코딩, 유니코드 디코딩',
  });

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
  <div class="flex">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">Encoder</div>
      <div>
        <Tag value="입력" />
      </div>
      <Textarea placeholder="여기에 입력하세요." rows="3" cols="30" v-model="orgData" />
      <div class="flex flex-col gap-4 pt-4 md:flex-row">
        <div class="flex grow basis-0 flex-col gap-4">
          <div>
            <Tag severity="success" value="Base64 Encode" />
          </div>
          <Textarea rows="3" cols="30" v-model="convert.base64Encode" @click="handleCopy(convert.base64Encode)" readonly />
        </div>
        <div class="flex grow basis-0 flex-col gap-4">
          <div>
            <Tag severity="success" value="Base64 Decode" />
          </div>
          <Textarea rows="3" cols="30" v-model="convert.base64Decode" @click="handleCopy(convert.base64Decode)" readonly />
        </div>
      </div>
      <div class="flex flex-col gap-4 pt-4 md:flex-row">
        <div class="flex grow basis-0 flex-col gap-4">
          <div>
            <Tag severity="warn" value="URL Encode" />
          </div>
          <Textarea rows="3" cols="30" v-model="convert.urlEncode" @click="handleCopy(convert.urlEncode)" readonly />
        </div>
        <div class="flex grow basis-0 flex-col gap-4">
          <div>
            <Tag severity="warn" value="URL Decode" />
          </div>
          <Textarea rows="3" cols="30" v-model="convert.urlDecode" @click="handleCopy(convert.urlDecode)" readonly />
        </div>
      </div>
      <div class="flex flex-col gap-4 pt-4 md:flex-row">
        <div class="flex grow basis-0 flex-col gap-4">
          <div>
            <Tag severity="danger" value="Unicode Encode" />
          </div>
          <Textarea rows="3" cols="30" v-model="convert.unicodeEncode" @click="handleCopy(convert.unicodeEncode)" readonly />
        </div>
        <div class="flex grow basis-0 flex-col gap-4">
          <div>
            <Tag severity="danger" value="Unicode Decode" />
          </div>
          <Textarea rows="3" cols="30" v-model="convert.unicodeDecode" @click="handleCopy(convert.unicodeDecode)" readonly />
        </div>
      </div>
    </div>
  </div>
</template>
