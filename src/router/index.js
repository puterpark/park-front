import AppLayout from '@/layout/AppLayout.vue';
import Empty from '@/views/Empty.vue';
import NotFound from '@/views/NotFound.vue';
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
          component: Empty,
        },
        {
          path: '/tools/shorten-url',
          name: 'shortenUrl',
          component: () => import('@/views/tools/ShortenUrl.vue'),
        },
        {
          path: '/tools/qrcode',
          name: 'qrCode',
          component: () => import('@/views/tools/QrCode.vue'),
        },
        {
          path: '/tools/encoder',
          name: 'encoder',
          component: () => import('@/views/tools/Encoder.vue'),
        },
        {
          path: '/tools/jasypt',
          name: 'jasypt',
          component: () => import('@/views/tools/Jasypt.vue'),
        },
        {
          path: '/tools/aes',
          name: 'aes',
          component: () => import('@/views/tools/Aes.vue'),
        },
        {
          path: '/tools/password',
          name: 'password',
          component: () => import('@/views/tools/Password.vue'),
        },
        {
          path: '/tools/unix-time',
          name: 'unixTime',
          component: () => import('@/views/tools/UnixTime.vue'),
        },
        {
          path: '/tools/file-size',
          name: 'fileSize',
          component: () => import('@/views/tools/FileSize.vue'),
        },
      ],
    },

    {
      path: '/:pathMatch(.*)*',
      name: 'notFound',
      component: NotFound,
    },
  ],
});

export default router;
