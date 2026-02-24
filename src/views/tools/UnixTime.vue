<script setup>
  import { computed, onMounted, onUnmounted, ref } from 'vue';
  import dayjs from 'dayjs';
  import { useAppToast } from '@/composables/useAppToast';
  import { useSeo } from '@/composables/useSeo';
  import { copyText } from '@/utils/commonUtils';

  useSeo({
    title: 'UnixTime',
    description: 'unixtime를 변환해 보세요.',
    keywords: 'unixtime, 유닉스타임, 변환, convert, converter',
  });

  const toast = useAppToast();

  const intervalUnixTime = ref(dayjs().unix());
  const intervalRealTime = ref(dayjs.unix(intervalUnixTime.value).format('YYYY-MM-DD HH:mm:ss'));

  const unixTime = ref(dayjs().unix());
  const realTime = computed({
    get() {
      return dayjs.unix(unixTime.value).toDate();
    },
    set(newValue) {
      if (newValue) {
        unixTime.value = dayjs(newValue).unix();
      }
    },
  });

  const updateUnixTime = (e) => {
    if (e.value !== null) {
      unixTime.value = e.value;
    }
  };

  let timer = null;

  onMounted(() => {
    timer = setInterval(() => {
      intervalUnixTime.value = dayjs().unix();
      intervalRealTime.value = dayjs.unix(intervalUnixTime.value).format('YYYY-MM-DD HH:mm:ss');
    }, 1000);
  });

  onUnmounted(() => {
    clearInterval(timer);
  });

  const handleCopy = async (text) => {
    const isSuccess = await copyText(text);
    if (isSuccess) {
      toast.success('클립보드에 복사되었습니다.');
    }
  };
</script>

<template>
  <div class="flex flex-col">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">UnixTime</div>
      <div class="flex flex-col items-center md:items-start">
        <div class="text-5xl font-black" @click="handleCopy(intervalUnixTime)">{{ intervalUnixTime }}</div>
        <div class="text-2xl font-black md:ml-6">{{ intervalRealTime }}</div>
      </div>
    </div>
    <div class="card flex flex-col gap-4">
      <div class="flex flex-col gap-4 md:flex-row">
        <InputGroup>
          <Tag value="Unix" class="w-12" />
          <InputNumber v-model="unixTime" showButtons mode="decimal" :useGrouping="false" @input="updateUnixTime" :max="9999999999" />
        </InputGroup>
      </div>
      <div class="flex flex-col gap-4 md:flex-row">
        <InputGroup>
          <Tag value="Real" severity="success" class="w-12" />
          <DatePicker v-model="realTime" showTime hourFormat="24" showSeconds dateFormat="yy-mm-dd" panelClass="custom-datepicker-panel" showIcon />
        </InputGroup>
      </div>
    </div>
  </div>
</template>

<style>
  /* 팝업이 열릴 때 지연 없이 스타일을 강제 적용 */
  .custom-datepicker-panel {
    width: 300px !important;
    min-width: 250px !important;
  }
</style>
