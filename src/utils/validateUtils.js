// URL 검증
export const validateUrl = (value) => {
  try {
    new URL(value);
    return true;
  } catch (e) {
    return false;
  }
};

// secretKey 검증
export const validateSecretKey = (value) => {
  return /^[A-Za-z0-9!@#$%^&*()_+={}\[\]:;"'<>,.?/~`-]*$/.test(value);
};
