import { useHead } from '@unhead/vue';

export const useSeo = (description, keywords) => {
  useHead({
    meta: [
      {
        name: 'description',
        content: description || '',
      },
      {
        name: 'keywords',
        content: keywords || '',
      },
    ],
  });
};
