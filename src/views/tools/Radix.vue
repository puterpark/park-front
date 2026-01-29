<script setup>
  import { nextTick, onMounted, ref, watch } from 'vue';

  import { useSeo } from '@/composables/useSeo';

  useSeo('숫자를 다양한 진법으로 변환해 보세요.', '숫자, 진법, radix, 10진법, 2진법, 8진법, 16진법, number, decimal, binary, octal, hexadecimal');

  const decimal = ref('');
  const binary = ref('');
  const octal = ref('');
  const hexadecimal = ref('');
  const useUpperCase = ref(true);

  const updateValues = (baseValue, unitType) => {
    const regEx = {
      decimal: /[^0-9]/g,
      binary: /[^0-1]/g,
      octal: /[^0-7]/g,
      hexadecimal: /[^0-9a-fA-F]/g,
    };

    const cleanValue = baseValue.replace(regEx[unitType], '');

    if (!cleanValue) {
      clearAll();
      return;
    }

    const refs = { decimal, binary, octal, hexadecimal };
    refs[unitType].value = cleanValue;

    try {
      // 1. parseInt 대신 BigInt를 사용하여 값 파싱
      let decimalValue;
      if (unitType === 'decimal') {
        decimalValue = BigInt(cleanValue);
      } else {
        const prefix = { binary: '0b', octal: '0o', hexadecimal: '0x' };
        decimalValue = BigInt(prefix[unitType] + cleanValue);
      }

      // 2. 각 진법으로 변환 (BigInt는 toString(radix)를 완벽히 지원함)
      decimal.value = decimalValue.toString(10);
      binary.value = decimalValue.toString(2);
      octal.value = decimalValue.toString(8);

      const hex = decimalValue.toString(16);
      hexadecimal.value = useUpperCase.value ? hex.toUpperCase() : hex.toLowerCase();
    } catch (e) {
      clearAll();
    }
  };

  const clearAll = () => {
    decimal.value = binary.value = octal.value = hexadecimal.value = '';
  };

  const onCompositionStart = (event) => {
    event.target.blur();

    nextTick(() => {
      event.target.focus();
    });
  };

  onMounted(() => {
    decimal.value = Math.floor(10000 + Math.random() * 90000).toString();
    updateValues(decimal.value, 'decimal');
  });

  watch(useUpperCase, () => {
    if (decimal.value) {
      updateValues(decimal.value, 'decimal');
    }
  });
</script>

<template>
  <div class="flex">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">Radix</div>
      <div class="flex flex-col gap-4 md:flex-row">
        <InputGroup>
          <Tag value="10진수" class="w-16" />
          <InputText v-model="decimal" v-keyfilter="/[0-9]/" @input="updateValues($event.target.value, 'decimal')" />
        </InputGroup>
      </div>
      <div class="flex flex-col gap-4 md:flex-row">
        <InputGroup>
          <Tag value="2진수" severity="success" class="w-16" />
          <InputText v-model="binary" v-keyfilter="/[0-1]/" @input="updateValues($event.target.value, 'binary')" />
        </InputGroup>
      </div>
      <div class="flex flex-col gap-4 md:flex-row">
        <InputGroup>
          <Tag value="8진수" severity="warn" class="w-16" />
          <InputText v-model="octal" v-keyfilter="/[0-7]/" @input="updateValues($event.target.value, 'octal')" />
        </InputGroup>
      </div>
      <div class="flex flex-col gap-4 md:flex-row">
        <InputGroup>
          <Tag value="16진수" severity="danger" class="w-16" />
          <InputText v-model="hexadecimal" v-keyfilter="/[0-9a-fA-F]/" @input="updateValues($event.target.value, 'hexadecimal')" />
          <InputGroupAddon>
            <Checkbox v-model="useUpperCase" :binary="true" v-tooltip.top="'체크 시 대문자 표기'" />
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  </div>
</template>
