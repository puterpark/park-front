import { createRouter, createWebHistory } from 'vue-router';

import AppLayout from '@/layout/AppLayout.vue';

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
      ],
    },
  ],
});

export default router;
