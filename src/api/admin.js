import api from '@/api';
import { API_URI } from '@/api/apiUri';

// 로그인
export const loginApi = (params) => {
  return api.post(API_URI.ADMIN.LOGIN, params);
};

// accessToken 재발급
export const refreshAccessTokenApi = () => {
  return api.post(API_URI.ADMIN.REFRESH);
};

// 단축링크 목록 조회
export const getShortenUrlListApi = (params, config = {}) => {
  return api.get(API_URI.ADMIN_SHORTEN_URL.LIST, { params, ...config });
};

// 단축링크 통계 조회
export const getShortenUrlStatisticApi = () => {
  return api.get(API_URI.ADMIN_SHORTEN_URL.STATISTIC);
};

// 단축링크 조회
export const getShortenUrlApi = (id) => {
  return api.get(API_URI.ADMIN_SHORTEN_URL.ITEM(id));
};

// 단축링크 수정
export const updateShortenUrlApi = (id, params) => {
  return api.patch(API_URI.ADMIN_SHORTEN_URL.ITEM(id), params);
};

// 단축링크 삭제
export const deleteShortenUrlApi = (id) => {
  return api.delete(API_URI.ADMIN_SHORTEN_URL.ITEM(id));
};
