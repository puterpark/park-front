<script setup>
  import { computed, ref } from 'vue';
  import dayjs from 'dayjs';
  import 'dayjs/locale/ko';
  import { useSeo } from '@/composables/useSeo';

  useSeo({
    title: 'CalcDate',
    description: '날짜를 계산해 보세요.',
    keywords: '시작일, 계산일, 날짜계산, 일자계산',
  });

  const baseDate = ref(new Date());
  const includeBaseDate = ref(false);
  const calcDay = ref(0);

  const calcDate = computed(() => {
    let offset = calcDay.value;

    if (offset === null || offset === undefined) {
      return '';
    }

    if (offset > 36500) {
      offset = 36500;
    }

    if (offset < -36500) {
      offset = -36500;
    }

    if (includeBaseDate.value) {
      if (offset > 0) {
        offset--;
      } else if (offset < 0) {
        offset++;
      }
    }

    return dayjs(baseDate.value).locale('ko').add(offset, 'day').format('YYYY-MM-DD (ddd)');
  });

  const calcDayInput = (e) => {
    calcDay.value = e.value;
  };

  const labelStyle = computed(() => ({
    color: includeBaseDate.value ? 'var(--p-primary-color)' : 'inherit',
  }));

  const setOffset = (days) => {
    calcDay.value = days;
  };
</script>

<template>
  <div class="flex">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">CalcDate</div>
      <div class="flex flex-col gap-4 md:flex-row">
        <div class="flex grow basis-0 flex-col gap-4">
          <div>
            <Tag value="기준일" />
          </div>
          <DatePicker v-model="baseDate" dateFormat="yy-mm-dd" panelClass="custom-datepicker-panel" showIcon fluid showButtonBar placeholder="기준일을 입력하세요." />
        </div>
      </div>
      <div class="flex flex-col gap-2 pt-4">
        <div>
          <Tag severity="success" value="Option" />
        </div>
        <InputGroup>
          <InputGroupAddon>
            <Checkbox inputId="include" name="option" binary v-model="includeBaseDate" />
            <label for="include" class="ml-2 cursor-pointer" :style="labelStyle">기준일 포함</label>
          </InputGroupAddon>
          <InputNumber :modelValue="calcDay" @input="calcDayInput" showButtons placeholder="일수를 입력하세요." v-tooltip.top="'-36,500~36,500'" :min="-36500" :max="36500" />
        </InputGroup>
        <div class="flex flex-wrap gap-2">
          <Button label="+7일" @click="setOffset(7)" severity="secondary" size="small" outlined />
          <Button label="+30일" @click="setOffset(30)" severity="secondary" size="small" outlined />
          <Button label="+100일" @click="setOffset(100)" severity="secondary" size="small" outlined />
          <Button label="+1년" @click="setOffset(365)" severity="secondary" size="small" outlined />
          <Button label="초기화" @click="setOffset(0)" severity="secondary" size="small" outlined icon="pi pi-refresh" />
        </div>
      </div>
      <div class="pt-4">
        <Tag value="계산일" severity="warn" />
      </div>
      <InputText :value="calcDate" readonly />
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
