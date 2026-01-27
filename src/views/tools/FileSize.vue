<script setup>
  import { useSeo } from '@/composables/useSeo';
  import Decimal from 'decimal.js';
  import { ref } from 'vue';

  useSeo('파일크기를 다양하게 변환해 보세요.', '파일크기, 변환, 파일크기 변환, filesize, byte, kb, mb, gb, tb');

  const byte = ref('0');
  const kb = ref('0');
  const mb = ref('0');
  const gb = ref('0');
  const tb = ref('0');

  Decimal.set({
    precision: 1000,
    rounding: Decimal.ROUND_DOWN,
  });

  const UNIT = new Decimal(1024);

  const updateValues = (baseValue, unitType) => {
    try {
      if (baseValue === '' || baseValue === null) {
        clearAll();
        return;
      }

      let base = new Decimal(baseValue);

      let byteVal;
      if (unitType === 'byte') byteVal = base;
      else if (unitType === 'kb') byteVal = base.times(UNIT);
      else if (unitType === 'mb') byteVal = base.times(UNIT.pow(2));
      else if (unitType === 'gb') byteVal = base.times(UNIT.pow(3));
      else if (unitType === 'tb') byteVal = base.times(UNIT.pow(4));

      byte.value = byteVal.toFixed();
      kb.value = byteVal.div(UNIT).toFixed();
      mb.value = byteVal.div(UNIT.pow(2)).toFixed();
      gb.value = byteVal.div(UNIT.pow(3)).toFixed();
      tb.value = byteVal.div(UNIT.pow(4)).toFixed();
    } catch (e) {}
  };

  const clearAll = () => {
    byte.value = kb.value = mb.value = gb.value = tb.value = '0';
  };
</script>

<template>
  <Fluid>
    <div class="flex">
      <div class="card flex w-full flex-col gap-4">
        <div class="text-xl font-semibold">FileSize</div>
        <div class="flex flex-col gap-4 md:flex-row">
          <InputGroup>
            <Tag value="Byte" class="w-12" />
            <InputText type="number" v-model="byte" @input="updateValues($event.target.value, 'byte')" />
          </InputGroup>
        </div>
        <div class="flex flex-col gap-4 md:flex-row">
          <InputGroup>
            <Tag value="KB" severity="success" class="w-12" />
            <InputText type="number" v-model="kb" @input="updateValues($event.target.value, 'kb')" />
          </InputGroup>
        </div>
        <div class="flex flex-col gap-4 md:flex-row">
          <InputGroup>
            <Tag value="MB" severity="warn" class="w-12" />
            <InputText type="number" v-model="mb" @input="updateValues($event.target.value, 'mb')" />
          </InputGroup>
        </div>
        <div class="flex flex-col gap-4 md:flex-row">
          <InputGroup>
            <Tag value="GB" severity="danger" class="w-12" />
            <InputText type="number" v-model="gb" @input="updateValues($event.target.value, 'gb')" />
          </InputGroup>
        </div>
        <div class="flex flex-col gap-4 md:flex-row">
          <InputGroup>
            <Tag value="TB" severity="contrast" class="w-12" />
            <InputText type="number" v-model="tb" @input="updateValues($event.target.value, 'tb')" />
          </InputGroup>
        </div>
      </div>
    </div>
  </Fluid>
</template>
