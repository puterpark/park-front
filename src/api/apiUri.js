export const API_URI = {
  MENU: {
    LIST: '/api/v1/menus',
  },
  SHORTEN_URL: '/api/v1/shorten-url',
  JASYPT: {
    ENCRYPT: '/api/v1/jasypt/encrypt',
    DECRYPT: '/api/v1/jasypt/decrypt',
  },
  AES: {
    ENCRYPT: '/api/v1/aes/encrypt',
    DECRYPT: '/api/v1/aes/decrypt',
  },
  IP: '/api/v1/ip',
  ADMIN: {
    LOGIN: '/api/v1/member/login',
    REFRESH: '/api/v1/member/refresh',
  },
  ADMIN_SHORTEN_URL: {
    ITEM: (id) => `/api/v1/admin/shorten-url/${id}`,
    STATISTIC: '/api/v1/admin/shorten-url/statistic',
    LIST: '/api/v1/admin/shorten-url/list',
  },
};
