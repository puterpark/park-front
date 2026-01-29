<script setup>
  import { onMounted, ref, watch } from 'vue';

  import { useSeo } from '@/composables/useSeo';

  useSeo('숫자를 다양한 진법으로 변환해 보세요.', '숫자, 진법, radix, 10진법, 2진법, 8진법, 16진법, number, decimal, binary, octal, hexadecimal');

  const decimal = ref('');
  const binary = ref('');
  const octal = ref('');
  const hexadecimal = ref('');
  const useUpperCase = ref(true);

  const updateValues = (base, unitType) => {
    const regEx = {
      decimal: /[^0-9]/g,
      binary: /[^0-1]/g,
      octal: /[^0-7]/g,
      hexadecimal: /[^0-9a-fA-F]/g,
    };

    const baseValue = base.replace(regEx[unitType], '');

    if (!baseValue) {
      clearAll();
      return;
    }

    const refs = { decimal, binary, octal, hexadecimal };
    refs[unitType].value = baseValue;

    try {
      let decimalValue;
      if (unitType === 'decimal') {
        decimalValue = BigInt(baseValue);
      } else {
        const prefix = { binary: '0b', octal: '0o', hexadecimal: '0x' };
        decimalValue = BigInt(prefix[unitType] + baseValue);
      }

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
          <InputText v-model="decimal" v-keyfilter="/[0-9]/" @valueChange="updateValues(decimal, 'decimal')" />
        </InputGroup>
      </div>
      <div class="flex flex-col gap-4 md:flex-row">
        <InputGroup>
          <Tag value="2진수" severity="success" class="w-16" />
          <InputText v-model="binary" v-keyfilter="/[0-1]/" @valueChange="updateValues(binary, 'binary')" />
        </InputGroup>
      </div>
      <div class="flex flex-col gap-4 md:flex-row">
        <InputGroup>
          <Tag value="8진수" severity="warn" class="w-16" />
          <InputText v-model="octal" v-keyfilter="/[0-7]/" @valueChange="updateValues(octal, 'octal')" />
        </InputGroup>
      </div>
      <div class="flex flex-col gap-4 md:flex-row">
        <InputGroup>
          <Tag value="16진수" severity="danger" class="w-16" />
          <InputText v-model="hexadecimal" v-keyfilter="/[0-9a-fA-F]/" @valueChange="updateValues(hexadecimal, 'hexadecimal')" />
          <InputGroupAddon>
            <Checkbox v-model="useUpperCase" :binary="true" v-tooltip.top="'체크 시 대문자 표기'" />
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  </div>
</template>
