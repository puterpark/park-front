<script setup>
  import { onMounted, ref } from 'vue';

  import { getIp } from '@/api/ip';
  import { useAppToast } from '@/composables/useAppToast';
  import { copyText } from '@/utils/commonUtils';

  import AppMenuItem from './AppMenuItem.vue';

  const toast = useAppToast();
  const ip = ref('');
  const model = ref([
    {
      label: 'HOME',
      items: [
        {
          label: 'Park',
          icon: 'pi pi-fw pi-home',
          to: '/',
        },
      ],
    },
    {
      label: 'NAS',
      items: [
        {
          label: 'sinoli',
          icon: 'pi pi-fw pi-server',
          url: 'https://nas.puter.us',
          target: '_self',
        },
        {
          label: 'jenkins',
          icon: 'pi pi-fw pi-box',
          url: 'https://jen.puter.us',
          target: '_self',
        },
      ],
    },
    {
      label: 'TOOLS',
      items: [
        {
          label: 'Shorten URL',
          icon: 'pi pi-fw pi-link',
          to: '/tools/shorten-url',
        },
        {
          label: 'QR Code',
          icon: 'pi pi-fw pi-qrcode',
          to: '/tools/qr-code',
        },
        {
          label: 'Encoder',
          icon: 'pi pi-fw pi-globe',
          to: '/tools/encoder',
        },
        {
          label: 'Jasypt',
          icon: 'pi pi-fw pi-key',
          to: '/tools/jasypt',
        },
        {
          label: 'Aes',
          icon: 'pi pi-fw pi-shield',
          to: '/tools/aes',
        },
        {
          label: 'Password',
          icon: 'pi pi-fw pi-unlock',
          to: '/tools/password',
        },
        {
          label: 'UnixTime',
          icon: 'pi pi-fw pi-clock',
          to: '/tools/unix-time',
        },
        {
          label: 'FileSize',
          icon: 'pi pi-fw pi-sync',
          to: '/tools/file-size',
        },
        {
          label: 'Radix',
          icon: 'pi pi-fw pi-calculator',
          to: '/tools/radix',
        },
      ],
    },
  ]);

  onMounted(async () => {
    const { code, data } = await getIp();
    ip.value = code === 'S0000' ? data.ip : '';
  });

  const handleCopy = async (text) => {
    const isSuccess = await copyText(text);
    if (isSuccess) {
      toast.success('클립보드에 복사되었습니다.');
    }
  };
</script>

<template>
  <ul class="layout-menu">
    <li class="my-4" v-if="ip">
      <Button severity="secondary" class="w-full" size="small" @click="handleCopy(ip)">{{ ip }}</Button>
    </li>
    <template v-for="(item, i) in model" :key="item">
      <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
      <li v-if="item.separator" class="menu-separator"></li>
    </template>
  </ul>
</template>

<style lang="scss" scoped></style>
