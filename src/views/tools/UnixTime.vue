<script setup>
  import { computed, ref } from 'vue';
  import dayjs from 'dayjs';

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
</script>

<template>
  <Fluid>
    <div class="flex">
      <div class="card flex w-full flex-col gap-4">
        <div class="text-xl font-semibold">UnixTime</div>
        <div class="flex flex-col gap-4 md:flex-row">
          <InputGroup>
            <Tag value="Unix" class="w-12" />
            <InputNumber v-model="unixTime" showButtons mode="decimal" :useGrouping="false" @input="updateUnixTime" />
          </InputGroup>
        </div>
        <div class="flex flex-col gap-4 md:flex-row">
          <InputGroup>
            <Tag value="Real" severity="success" class="w-12" />
            <DatePicker v-model="realTime" showTime hourFormat="24" showSeconds fluid dateFormat="yy-mm-dd" />
          </InputGroup>
        </div>
      </div>
    </div>
  </Fluid>
</template>
