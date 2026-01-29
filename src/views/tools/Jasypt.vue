<script setup>
  import { ref } from 'vue';

  import { decryptWithJasypt, encryptWithJasypt } from '@/api/jasypt';
  import { useApiWrapper } from '@/composables/useApiWrapper';
  import { useAppToast } from '@/composables/useAppToast';
  import { useSeo } from '@/composables/useSeo';
  import { copyText, getErrorMsg } from '@/utils/commonUtils';
  import { validateSecretKey } from '@/utils/validateUtils';

  useSeo('입력한 문자열을 jasypt 암호화 또는 복호화 해 보세요.', 'jasypt, encrypt, decrypt, jasypt 암호화, jasypt 복호화, jasypt encrypt, jasypt decrypt');

  const toast = useAppToast();
  const { withLoading } = useApiWrapper();

  const plainText = ref('');
  const secretKey = ref('');
  const returnText = ref('');

  // 암호화
  const encrypt = async () => {
    const plainTextValue = plainText.value;
    const secretKeyValue = secretKey.value;

    if (!plainTextValue || !secretKeyValue) {
      return toast.error('입력된 값을 확인해 주세요.');
    }

    if (!validateSecretKey(secretKeyValue)) {
      return toast.error('비밀 키', '영문자, 숫자, 특수문자만 사용할 수 있습니다.');
    }

    await withLoading(async () => {
      const params = {
        plainText: plainTextValue,
        secretKey: secretKeyValue,
      };

      const { code, data } = await encryptWithJasypt(params);
      if (code === 'S0000') {
        returnText.value = data.encText;
      } else {
        toast.error(getErrorMsg(code));
      }
    });
  };

  // 복호화
  const decrypt = async () => {
    const plainTextValue = plainText.value;
    const secretKeyValue = secretKey.value;

    if (!plainTextValue || !secretKeyValue) {
      return toast.error('입력된 값을 확인해 주세요.');
    }

    if (!validateSecretKey(secretKeyValue)) {
      return toast.error('비밀 키', '영문자, 숫자, 특수문자만 사용할 수 있습니다.');
    }

    await withLoading(async () => {
      const params = {
        encText: plainTextValue,
        secretKey: secretKeyValue,
      };

      const { code, data } = await decryptWithJasypt(params);
      if (code === 'S0000') {
        returnText.value = data.decText;
      } else {
        toast.error(getErrorMsg(code));
      }
    });
  };

  const handleCopy = async (text) => {
    const isSuccess = await copyText(text);
    if (isSuccess) {
      toast.success('클립보드에 복사되었습니다.');
    }
  };
</script>
<template>
  <div class="flex">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">Jasypt</div>
      <div>
        <Tag value="Plain Text" />
      </div>
      <Textarea placeholder="여기에 입력하세요." :auto-resize="true" rows="3" cols="30" v-model="plainText" />
      <div class="flex flex-wrap gap-4 pt-4">
        <div class="flex grow basis-0 flex-col gap-4">
          <div>
            <Tag severity="success" value="Secret Key" />
          </div>
          <Textarea placeholder="여기에 입력하세요." :auto-resize="true" rows="1" cols="30" v-model="secretKey" />
        </div>
      </div>
      <Fluid>
        <div class="flex flex-col gap-4 pt-4">
          <div class="flex flex-row gap-4">
            <Button label="암호화" severity="contrast" @click="encrypt()" />
            <Button label="복호화" severity="secondary" @click="decrypt()" />
          </div>
        </div>
      </Fluid>
      <div class="flex flex-wrap gap-4 pt-4">
        <div class="flex grow basis-0 flex-col gap-4">
          <div>
            <Tag severity="warn" value="Return" />
          </div>
          <Textarea placeholder="암호화/복호화된 값이 여기에 출력됩니다." :auto-resize="true" rows="3" cols="30" v-model="returnText" @click="handleCopy(returnText)" readonly />
        </div>
      </div>
    </div>
  </div>
</template>
