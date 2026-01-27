import { ERROR_MSG } from '@/constants/errorMsg';

/**
 * 에러 처리
 * @param code
 */
export const getErrorMsg = (code) => {
  if (code) {
    return ERROR_MSG[code] ?? ERROR_MSG.E0003;
  } else {
    return ERROR_MSG.E0003;
  }
};

/**
 * 복사
 * @param text
 * @returns {Promise<boolean>}
 */
export const copyText = async (text) => {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
};
