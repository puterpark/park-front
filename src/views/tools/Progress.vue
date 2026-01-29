<script setup>
  import { ref } from 'vue';

  import dayjs from 'dayjs';

  import { useSeo } from '@/composables/useSeo';

  useSeo('날짜를 설정하여 진행상태를 확인해 보세요.', '시작일, 기준일, 종료일, 진행, 진행상태');

  const startDate = ref('');
  const stdDate = ref(dayjs().format('YYYY-MM-DD'));
  const endDate = ref('');
  const progressValue = ref(0);

  const calcProgress = () => {
    // 날짜 값 확인
    if (!startDate.value || !endDate.value || !stdDate.value) {
      progressValue.value = 0;
      return;
    }

    const start = dayjs(startDate.value);
    const end = dayjs(endDate.value);
    const std = dayjs(stdDate.value);

    // 시작일이 종료일보다 늦거나 같은 경우 예외 처리
    const totalDays = end.diff(start, 'day') + 1;
    if (totalDays <= 0) {
      progressValue.value = 0;
      return;
    }

    // 시작일로부터 기준일까지 경과된 일수 계산
    const passedDays = std.diff(start, 'day') + 1;

    // 진행률 계산
    let progress = (passedDays / totalDays) * 100;

    // 기준일이 시작일보다 이전이면 0, 종료일보다 이후면 100으로 고정
    progress = Math.max(0, Math.min(100, progress));

    // 소수점 첫째 자리까지 반올림
    progressValue.value = parseFloat(progress.toFixed(1));
  };
</script>

<template>
  <div class="flex">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">Progress</div>
      <div class="flex flex-col gap-4 pt-4 md:flex-row">
        <InputGroup>
          <Tag value="시작일" class="w-16" />
          <DatePicker v-model="startDate" dateFormat="yy-mm-dd" panelClass="custom-datepicker-panel" @valueChange="calcProgress" showIcon :maxDate="endDate" />
        </InputGroup>
        <InputGroup>
          <Tag value="기준일" severity="success" class="w-16" />
          <DatePicker v-model="stdDate" dateFormat="yy-mm-dd" panelClass="custom-datepicker-panel" @valueChange="calcProgress" showIcon :minDate="startDate" :maxDate="endDate" />
        </InputGroup>
        <InputGroup>
          <Tag value="종료일" severity="warn" class="w-16" />
          <DatePicker v-model="endDate" dateFormat="yy-mm-dd" panelClass="custom-datepicker-panel" @valueChange="calcProgress" showIcon :minDate="startDate" />
        </InputGroup>
      </div>
    </div>
  </div>
  <div class="mt-8 flex" v-if="progressValue">
    <div class="card flex w-full flex-col gap-4">
      <Tag value="Result" class="w-16" />
      <ProgressBar :value="progressValue" />
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
