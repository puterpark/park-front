import { useToast } from 'primevue';

export const useAppToast = () => {
  const toast = useToast();

  const show = (severity, summary, detail, life = 3000) => {
    toast.add({ severity, summary, detail, life });
  };

  const info = (summary, detail = '', life = 3000) => {
    show('info', summary, detail, life);
  };

  const success = (summary, detail = '', life = 3000) => {
    show('success', summary, detail, life);
  };

  const warn = (summary, detail = '', life = 3000) => {
    show('warn', summary, detail, life);
  };

  const error = (summary, detail = '', life = 3000) => {
    show('error', summary, detail, life);
  };

  return {
    error,
    warn,
    success,
    info,
  };
};
