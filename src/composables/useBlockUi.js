import { ref } from 'vue';

const isBlocked = ref(false);

export const useBlockUi = () => {
  const blockUi = () => {
    isBlocked.value = true;
  };

  const unblockUi = () => {
    isBlocked.value = false;
  };

  return {
    isBlocked,
    blockUi,
    unblockUi,
  };
};
