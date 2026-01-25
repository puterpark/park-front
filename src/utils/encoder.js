export const encoder = {
  // Base64
  base64: {
    encode: (str) => btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1))),
    decode: (str) =>
      decodeURIComponent(
        atob(str)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      ),
  },

  // URL
  url: {
    encode: (str) => encodeURIComponent(str),
    decode: (str) => decodeURIComponent(str),
  },

  // Unicode
  unicode: {
    encode: (str) =>
      str
        .split('')
        .map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
        .join(''),
    decode: (str) => str.replace(/\\u([\d\w]{4})/gi, (match, grp) => String.fromCharCode(parseInt(grp, 16))),
  },
};
