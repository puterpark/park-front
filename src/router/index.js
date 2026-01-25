import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '/',
          name: 'empty',
          component: () => import('@/views/pages/Empty.vue'),
        },
        {
          path: '/tools/shorten-url',
          name: 'shortenUrl',
          component: () => import('@/views/pages/tools/ShortenUrl.vue'),
        },
        {
          path: '/tools/qrcode',
          name: 'qrCode',
          component: () => import('@/views/pages/tools/QrCode.vue'),
        },
        {
          path: '/tools/encoder',
          name: 'encoder',
          component: () => import('@/views/pages/tools/Encoder.vue'),
        },
      ],
    },
  ],
});

export default router;
