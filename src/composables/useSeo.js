import { useHead } from '@unhead/vue';

export const useSeo = ({ title, description, keywords }) => {
  title = title || '';
  description = description || '';
  keywords = keywords || '';
  
  useHead({
    title: 'PUTER.US' + (title ? ` | ${title}` : ''),
    meta: [
      {
        name: 'description',
        content: description,
      },
      {
        name: 'keywords',
        content: keywords,
      },
    ],
  });
};
