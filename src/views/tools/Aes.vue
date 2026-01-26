<script setup>
  import { useAppToast } from '@/composables/useAppToast';
  import { copyText, getErrorMsg } from '@/utils/commonUtils';
  import { validateIv, validateSecretKey } from '@/utils/validateUtils';
  import { ref } from 'vue';
  import { decryptWithAes, encryptWithAes } from '@/api/aes';

  const toast = useAppToast();
  const plainText = ref('');
  const secretKey = ref('');
  const iv = ref('');
  const returnText = ref('');
  const useBase64 = ref([]);

  // 암호화
  const encrypt = () => {
    const plainTextValue = plainText.value;
    const secretKeyValue = secretKey.value;

    if (!plainTextValue || !secretKeyValue) {
      return toast.error('입력된 값을 확인해 주세요.');
    }

    const secretKeyLength = secretKeyValue.length;
    if ((secretKeyLength !== 16 && secretKeyLength !== 24 && secretKeyLength !== 32) || !validateSecretKey(secretKeyValue)) {
      return toast.error('비밀 키', '16/24/32자리의 영문자, 숫자, 특수문자만 사용할 수 있습니다.');
    }

    const ivValue = iv.value;
    if (ivValue && !validateIv(ivValue)) {
      return toast.error('iv', '16자리 영문자, 숫자, 특수문자만 사용할 수 있습니다.');
    }

    const params = {
      plainText: plainTextValue,
      secretKey: secretKeyValue,
      iv: ivValue,
      useBase64: useBase64.value.includes('Y') ? 'Y' : 'N',
    };

    encryptWithAes(params)
      .then((result) => {
        if (result.code === 'S0000') {
          const data = result.data;
          returnText.value = data.encText;
        }
      })
      .catch((error) => {
        toast.error(getErrorMsg(error));
      });
  };

  // 복호화
  const decrypt = () => {
    const plainTextValue = plainText.value;
    const secretKeyValue = secretKey.value;

    if (!plainTextValue || !secretKeyValue) {
      return toast.error('입력된 값을 확인해 주세요.');
    }

    const secretKeyLength = secretKeyValue.length;
    if ((secretKeyLength !== 16 && secretKeyLength !== 24 && secretKeyLength !== 32) || !validateSecretKey(secretKeyValue)) {
      return toast.error('비밀 키', '16/24/32자리의 영문자, 숫자, 특수문자만 사용할 수 있습니다.');
    }

    const ivValue = iv.value;
    if (ivValue && !validateIv(ivValue)) {
      return toast.error('iv', '16자리 영문자, 숫자, 특수문자만 사용할 수 있습니다.');
    }

    const params = {
      encText: plainTextValue,
      secretKey: secretKeyValue,
      iv: ivValue,
      useBase64: useBase64.value.includes('Y') ? 'Y' : 'N',
    };

    decryptWithAes(params)
      .then((result) => {
        if (result.code === 'S0000') {
          const data = result.data;
          returnText.value = data.decText;
        }
      })
      .catch((error) => {
        toast.error(getErrorMsg(error));
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
  <Fluid>
    <div class="flex">
      <div class="card flex w-full flex-col gap-4">
        <div class="text-xl font-semibold">Aes</div>
        <label>
          <Tag value="Plain Text"></Tag>
        </label>
        <Textarea placeholder="여기에 입력하세요." :auto-resize="true" rows="3" cols="30" v-model="plainText" />
        <div class="flex flex-col gap-4 pt-4 md:flex-row">
          <div class="flex grow basis-0 flex-col gap-2">
            <label>
              <Tag severity="success" value="Secret Key" />
            </label>
            <Textarea placeholder="여기에 입력하세요." :auto-resize="true" rows="1" cols="30" v-model="secretKey" v-tooltip="'16/24/32자'" />
          </div>
          <div class="flex grow basis-0 flex-col gap-2">
            <label>
              <Tag severity="success" value="iv" />
            </label>
            <Textarea placeholder="여기에 입력하세요." :auto-resize="true" rows="1" cols="30" v-model="iv" v-tooltip="'미입력 시 Secret Key 기반으로 작동'" />
          </div>
          <div class="flex grow basis-0 flex-col gap-2">
            <label>
              <Tag severity="success" value="Option" />
            </label>
            <div class="mt-2 flex items-center">
              <Checkbox inputId="base64Check" name="option" value="Y" v-model="useBase64" />
              <label for="base64Check" class="ml-2 cursor-pointer">Base64 인코딩 사용</label>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-4 pt-4">
          <div class="flex flex-row gap-4">
            <Button label="암호화" severity="contrast" @click="encrypt()" />
            <Button label="복호화" severity="secondary" @click="decrypt()" />
          </div>
        </div>
        <div class="flex flex-wrap gap-4 pt-4">
          <div class="flex grow basis-0 flex-col gap-2">
            <label>
              <Tag severity="warn" value="Return"></Tag>
            </label>
            <Textarea placeholder="암호화/복호화된 값이 여기에 출력됩니다." :auto-resize="true" rows="3" cols="30" v-model="returnText" @click="handleCopy(returnText)" readonly />
          </div>
        </div>
      </div>
    </div>
  </Fluid>
</template>
