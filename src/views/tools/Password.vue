<script setup>
  import { useAppToast } from '@/composables/useAppToast';
  import { useSeo } from '@/composables/useSeo';
  import { copyText } from '@/utils/commonUtils';
  import { computed, ref } from 'vue';

  useSeo('다양한 조건으로 비밀번호를 생성해 보세요.', '비밀번호, 비밀번호 생성, 비밀번호 생성기, Password, Password Generate, Password Generator');

  const toast = useAppToast();
  const pwLength = ref(16);
  const pwOption = ref(['upper', 'lower', 'number']);

  const password = computed(() => {
    return generatePw(pwLength.value);
  });

  const generatePw = (length) => {
    const upperChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowerChar = 'abcdefghijklmnopqrstuvwxyz';
    const numberChar = '0123456789';
    const specialChar = "!@#$%^&*()-_=+[]{}|;:',.<>?/`~";

    let chars = '';
    const pwOptionValue = pwOption.value;

    if (pwOptionValue.includes('upper')) chars += upperChar;
    if (pwOptionValue.includes('lower')) chars += lowerChar;
    if (pwOptionValue.includes('number')) chars += numberChar;
    if (pwOptionValue.includes('special')) chars += specialChar;
    if (pwOptionValue.includes('confuse')) {
      const removeChar = "lLIij1!|oO0sS5;:,.`'";
      chars = chars.replace(new RegExp(`[${removeChar}]`, 'g'), '');
    }

    let randomStr = '';
    for (let i = 0; i < length; i++) {
      let randomIdx = Math.floor(Math.random() * chars.length);
      randomStr += chars[randomIdx];
    }

    return randomStr;
  };

  const handleCopy = async (text) => {
    const isSuccess = await copyText(text);
    if (isSuccess) {
      toast.success('클립보드에 복사되었습니다.');
    }
  };
</script>
<template>
  <Fluid>
    <div class="flex">
      <div class="card flex w-full flex-col gap-4">
        <div class="text-xl font-semibold">Password</div>
        <div class="flex flex-col gap-4 md:flex-row">
          <div class="flex grow basis-0 flex-col gap-4">
            <div>
              <Tag severity="success" value="길이" />
            </div>
            <InputNumber
              v-model="pwLength"
              showButtons
              mode="decimal"
              :min="1"
              :max="10000"
              @input="(e) => (pwLength = Math.min(10000, Math.max(1, e.value || 1)))"
              v-tooltip.top="'1~10,000자'"
            ></InputNumber>
          </div>
          <div class="flex grow basis-0 flex-col gap-4">
            <div>
              <Tag severity="warn" value="Option" />
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div>
                <Checkbox
                  inputId="upper"
                  name="option"
                  value="upper"
                  v-model="pwOption"
                  :style="{
                    '--p-checkbox-checked-background': pwOption.includes('upper') ? 'var(--p-red-500)' : '',
                    '--p-checkbox-checked-border-color': pwOption.includes('upper') ? 'var(--p-red-500)' : '',
                    '--p-checkbox-checked-hover-background': pwOption.includes('upper') ? 'var(--p-red-500)' : '',
                    '--p-checkbox-checked-hover-border-color': pwOption.includes('upper') ? 'var(--p-red-500)' : '',
                  }"
                  v-tooltip.top="'영어 대문자'"
                />
                <label for="upper" class="ml-2 cursor-pointer" :style="{ color: pwOption.includes('upper') ? 'var(--p-red-500)' : 'inherit' }">ABC</label>
              </div>
              <div>
                <Checkbox
                  inputId="lower"
                  name="option"
                  value="lower"
                  v-model="pwOption"
                  :style="{
                    '--p-checkbox-checked-background': pwOption.includes('lower') ? 'var(--p-orange-500)' : '',
                    '--p-checkbox-checked-border-color': pwOption.includes('lower') ? 'var(--p-orange-500)' : '',
                    '--p-checkbox-checked-hover-background': pwOption.includes('lower') ? 'var(--p-orange-500)' : '',
                    '--p-checkbox-checked-hover-border-color': pwOption.includes('lower') ? 'var(--p-orange-500)' : '',
                  }"
                  v-tooltip.top="'영어 소문자'"
                />
                <label for="lower" class="ml-2 cursor-pointer" :style="{ color: pwOption.includes('lower') ? 'var(--p-orange-500)' : 'inherit' }">abc</label>
              </div>
              <div>
                <Checkbox
                  inputId="number"
                  name="option"
                  value="number"
                  v-model="pwOption"
                  :style="{
                    '--p-checkbox-checked-background': pwOption.includes('number') ? 'var(--p-amber-500)' : '',
                    '--p-checkbox-checked-border-color': pwOption.includes('number') ? 'var(--p-amber-500)' : '',
                    '--p-checkbox-checked-hover-background': pwOption.includes('number') ? 'var(--p-amber-500)' : '',
                    '--p-checkbox-checked-hover-border-color': pwOption.includes('number') ? 'var(--p-amber-500)' : '',
                  }"
                  v-tooltip.top="'숫자'"
                />
                <label for="number" class="ml-2 cursor-pointer" :style="{ color: pwOption.includes('number') ? 'var(--p-amber-500)' : 'inherit' }">123</label>
              </div>
              <div>
                <Checkbox
                  inputId="special"
                  name="option"
                  value="special"
                  v-model="pwOption"
                  :style="{
                    '--p-checkbox-checked-background': pwOption.includes('special') ? 'var(--p-lime-600)' : '',
                    '--p-checkbox-checked-border-color': pwOption.includes('special') ? 'var(--p-lime-600)' : '',
                    '--p-checkbox-checked-hover-background': pwOption.includes('special') ? 'var(--p-lime-600)' : '',
                    '--p-checkbox-checked-hover-border-color': pwOption.includes('special') ? 'var(--p-lime-600)' : '',
                  }"
                  v-tooltip.top="'특수문자'"
                />
                <label for="special" class="ml-2 cursor-pointer" :style="{ color: pwOption.includes('special') ? 'var(--p-lime-600)' : 'inherit' }">!@#</label>
              </div>
              <div>
                <Checkbox inputId="confuse" name="option" value="confuse" v-model="pwOption" v-tooltip.top="'혼동되는 문자 제거'" />
                <label for="confuse" class="ml-2 cursor-pointer line-through" :style="{ color: pwOption.includes('confuse') ? 'var(--p-primary-color)' : 'inherit' }">!?</label>
              </div>
            </div>
          </div>
        </div>
        <div class="pt-4">
          <Tag value="비밀번호" />
        </div>
        <Textarea :auto-resize="true" rows="3" cols="30" :value="password" @click="handleCopy(password)" readonly />
      </div>
    </div>
  </Fluid>
</template>
