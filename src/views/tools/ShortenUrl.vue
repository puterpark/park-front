<script setup>
  import { ref } from 'vue';
  import { createShortenUrlApi } from '@/api/shortenUrl';
  import { useApiWrapper } from '@/composables/useApiWrapper';
  import { useAppToast } from '@/composables/useAppToast';
  import { useSeo } from '@/composables/useSeo';
  import { copyText, getErrorMsg } from '@/utils/commonUtils';
  import { validateUrl } from '@/utils/validateUtils';

  useSeo({
    title: 'Shorten URL',
    description: 'URL를 입력하여 짧은 링크(shortenURL)를 생성해 보세요.',
    keywords: 'shortenURL, 짧은 링크, 단축 링크',
  });

  const toast = useAppToast();
  const { withLoading } = useApiWrapper();

  const orgUrl = ref('');
  const shortenUrl = ref('');
  const validUrl = ref(false);

  const shorten = async () => {
    validUrl.value = false;

    if (!validateUrl(orgUrl.value)) {
      validUrl.value = true;
      return toast.error('유효하지 않은 URL 형식입니다.');
    }

    await withLoading(async () => {
      const params = { orgUrl: orgUrl.value };
      const { code, data } = await createShortenUrlApi(params);
      if (code === 'S0000') {
        shortenUrl.value = `${window.location.origin}/s/${data.shortenUri}`;
      } else {
        toast.error(getErrorMsg(code));
      }
    });
  };

  const handleCopy = async (uri) => {
    const isSuccess = await copyText(uri);
    if (isSuccess) {
      toast.success('클립보드에 복사되었습니다.');
    }
  };
</script>
<template>
  <div class="flex">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">Shorten URL</div>
      <div class="flex flex-col gap-4 md:flex-row">
        <InputGroup>
          <Button label="Shorten" @click="shorten" />
          <InputText id="orgUrl" placeholder="URL" v-model="orgUrl" :invalid="validUrl" @keyup.enter="shorten" />
        </InputGroup>
      </div>
    </div>
  </div>
  <div class="mt-8 flex" v-if="shortenUrl">
    <div class="card flex w-full flex-col gap-4">
      <div class="hover:text-primary-500 cursor-pointer text-xl font-semibold" @click="handleCopy(shortenUrl)">
        {{ shortenUrl }}
      </div>
    </div>
  </div>
</template>
