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
      ],
    },
  ],
});

export default router;
