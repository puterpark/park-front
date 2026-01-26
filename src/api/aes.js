import api from '@/api';
import { API_URI } from '@/api/apiUri';

// aes 암호화
export const encryptWithAes = (params) => {
  return api.post(API_URI.AES.ENCRYPT, params);
};

// aes 복호화
export const decryptWithAes = (params) => {
  return api.post(API_URI.AES.DECRYPT, params);
};
