<script setup>
  import { ref } from 'vue';

  import AppMenuItem from './AppMenuItem.vue';

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
          to: '/tools/qrcode',
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
      ],
    },
  ]);
</script>

<template>
  <ul class="layout-menu">
    <template v-for="(item, i) in model" :key="item">
      <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
      <li v-if="item.separator" class="menu-separator"></li>
    </template>
  </ul>
</template>

<style lang="scss" scoped></style>
