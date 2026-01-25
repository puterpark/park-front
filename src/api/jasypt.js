import api from '@/api';
import { API_URI } from '@/api/apiUri';

// jasypt 암호화
export const encryptWithJasypt = (params) => {
  return api.post(API_URI.JASYPT.ENCRYPT, params);
};

// jasypt 복호화
export const decryptWithJasypt = (params) => {
  return api.post(API_URI.JASYPT.DECRYPT, params);
};
