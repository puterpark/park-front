import api from '@/api';
import { API_URI } from '@/api/apiUri';

// IP 조회
export const getIpApi = () => {
  return api.get(API_URI.IP);
};
