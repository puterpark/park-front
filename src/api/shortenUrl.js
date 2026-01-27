import api from '@/api';
import { API_URI } from '@/api/apiUri';

// 단축링크 생성
export const createShortenUrl = (params) => {
  return api.post(API_URI.SHORTEN_URL, params);
};
