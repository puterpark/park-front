<script setup>
  import { computed, ref } from 'vue';
  import { useAppToast } from '@/composables/useAppToast';
  import { useSeo } from '@/composables/useSeo';
  import { copyText } from '@/utils/commonUtils';

  useSeo({
    title: 'TextLength',
    description: '입력한 문자열의 길이를 확인해 보세요.',
    keywords: '글자수 세기, 문자열 길이',
  });

  const toast = useAppToast();
  const inputData = ref('');

  const inputDataLength = computed(() => {
    return inputData.value.length;
  });

  const inputDataByte = computed(() => {
    return new TextEncoder().encode(inputData.value).length;
  });

  const inputDataLengthWithoutSpace = computed(() => {
    return inputData.value.replace(/\s/g, '').length;
  });

  const inputDataByteWithoutSpace = computed(() => {
    const pureText = inputData.value.replace(/\s/g, '');
    return new TextEncoder().encode(pureText).length;
  });

  const handleCopy = async (text) => {
    const isSuccess = await copyText(text);
    if (isSuccess) {
      toast.success('클립보드에 복사되었습니다.');
    }
  };

  const reset = () => {
    inputData.value = '';
  };
</script>
<template>
  <div class="flex">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">TextLength</div>
      <div class="mr-8 flex items-center gap-2">
        <div>
          <Tag value="공백 포함" />
        </div>
        <div>
          <span class="text-primary-700 dark:text-primary-300 font-bold">{{ inputDataLength }}</span>
          자 /
          <span class="text-primary-700 dark:text-primary-300 font-bold">{{ inputDataByte }}</span>
          byte
        </div>
      </div>
      <div class="mr-8 flex items-center gap-2">
        <div>
          <Tag severity="success" value="공백 제외" />
        </div>
        <div>
          <span class="font-bold text-green-700 dark:text-green-300">{{ inputDataLengthWithoutSpace }}</span>
          자 /
          <span class="font-bold text-green-700 dark:text-green-300">{{ inputDataByteWithoutSpace }}</span>
          byte
        </div>
      </div>
      <Textarea placeholder="여기에 입력하세요." rows="20" cols="30" v-model="inputData" />
      <Fluid v-if="inputData">
        <div class="flex flex-col gap-4 pt-4">
          <div class="flex flex-row gap-4">
            <Button label="복사" severity="contrast" @click="handleCopy(inputData)" />
            <Button label="초기화" severity="secondary" @click="reset" />
          </div>
        </div>
      </Fluid>
    </div>
  </div>
</template>
