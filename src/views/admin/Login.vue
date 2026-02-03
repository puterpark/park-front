<script setup>
  import { ref } from 'vue';

  import { loginApi } from '@/api/admin';
  import GlobalBlockUi from '@/components/GlobalBlockUi.vue';
  import { useApiWrapper } from '@/composables/useApiWrapper';
  import { useAppToast } from '@/composables/useAppToast';
  import router from '@/router';
  import { useAdminStore } from '@/stores/useAdminStore';
  import { getErrorMsg } from '@/utils/commonUtils';

  const username = ref('');
  const password = ref('');

  const toast = useAppToast();
  const { withLoading } = useApiWrapper();
  const adminStore = useAdminStore();

  const handleLogin = async () => {
    if (!username.value || !password.value) {
      return toast.error(getErrorMsg('F1002'));
    }

    await withLoading(async () => {
      const params = {
        username: username.value,
        password: password.value,
      };
      const { code, data } = await loginApi(params);
      if (code === 'S0000') {
        adminStore.accessToken = data.accessToken;
        return await router.push('/admin');
      } else {
        toast.error(getErrorMsg(code));
      }
    });
  };
</script>

<template>
  <div class="bg-surface-50 dark:bg-surface-950 flex min-h-screen min-w-screen items-center justify-center overflow-hidden">
    <div class="flex flex-col items-center justify-center">
      <div class="rounded-[56px] bg-[linear-gradient(180deg,var(--primary-color)_10%,rgba(33,150,243,0)_30%)] p-[0.3rem]">
        <div class="bg-surface-0 dark:bg-surface-900 w-full rounded-[53px] px-16 py-20 sm:px-20">
          <div class="mb-8 flex flex-col items-center justify-center">
            <img src="https://cdn.puter.us/images/apple-touch-icon.png" alt="" class="mb-8 w-16 cursor-pointer rounded-md" @click="$router.push('/')" />
          </div>
          <div>
            <label for="username" class="text-surface-900 dark:text-surface-0 mb-2 block text-xl font-medium">Username</label>
            <InputText id="username" type="text" placeholder="Username" class="mb-8 w-full md:w-120" v-model="username" />
            <label for="password" class="text-surface-900 dark:text-surface-0 mb-2 block text-xl font-medium">Password</label>
            <Password id="password" v-model="password" placeholder="Password" :toggleMask="true" class="mb-4" fluid :feedback="false" @keyup.enter="handleLogin"></Password>
            <Button label="Login" class="mt-6 w-full" @click="handleLogin"></Button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <Toast />
  <GlobalBlockUi />
</template>

<style scoped>
  .pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
  }

  .pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
  }
</style>
