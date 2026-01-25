// URL 검증
export const validateUrl = (value) => {
  try {
    new URL(value);
    return true;
  } catch (e) {
    return false;
  }
};
