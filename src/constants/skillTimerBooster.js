// 부스터 "남은시간 XX.XX초" 패널 (화면 위쪽 가운데, 201x54).
// 패널은 왼쪽의 시계 아이콘 + "남은시간" 글자(LABEL)로 찾고, 오른쪽의 7세그먼트 숫자를 읽는다.
// 패널은 반투명이라 뒤 배경에 따라 전체 밝기가 달라지지만, 일치도(정규화 상관)는 밝기 변화에 강하다.

// 패널을 찾는 기준 이미지와, 그 이미지가 패널 안에서 놓인 위치(패널 왼쪽 위 기준)
export const BOOSTER_LABEL = { src: '/skill-timer-presets/booster-label.png', x: 6, y: 6 };

// 숫자 칸 4개(XX.XX)의 왼쪽 x (패널 기준). 각 칸은 폭 약 17px, 높이 y 11~40
const DIGIT_CELLS = [84, 104, 136, 157];

// 7세그먼트 각 획을 확인할 점 (칸 왼쪽 기준 dx, 패널 기준 y). 점 중 하나라도 켜져 있으면 그 획이 켜진 것
// prettier-ignore
const SEGMENTS = {
  a: [[8, 12], [6, 12], [10, 12]],
  b: [[15, 19], [14, 19]],
  c: [[15, 32], [14, 32]],
  d: [[8, 39], [6, 39], [10, 39]],
  e: [[1, 32], [2, 32]],
  f: [[1, 19], [2, 19]],
  g: [[8, 25], [6, 25], [10, 25]],
};

// "XX.XX" 사이의 소수점(5x5 점)의 가운데와 상하좌우. 같은 "남은시간" 라벨을 쓰는 "9분 46초" 패널은 이 자리에
// "분" 글자가 걸치지만 가운데(130, 38)가 비어 있어서, 5곳이 모두 켜져 있을 때만 부스터 패널로 본다
const DECIMAL_POINT = [
  [130, 37],
  [129, 38],
  [130, 38],
  [131, 38],
  [130, 39],
];

// 켜진 획 → 숫자. 빈 칸(앞자리 없음)은 0으로 본다
const DIGITS = { abcdef: 0, bc: 1, abdeg: 2, abcdg: 3, bcfg: 4, acdfg: 5, acdefg: 6, abc: 7, abcdefg: 8, abcdfg: 9, '': 0 };

// 숫자 색은 위는 밝은 노랑(#ffffdd), 아래는 주황(#ffbb00). 화면 공유 영상은 색을 2x2 단위로 뭉개도
// 밝기는 거의 그대로라 밝기로 보고, 흰 글자와 구분하려고 빨강이 파랑보다 낮지 않은지만 본다
const isLit = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b > 140 && r >= b;

// 이 높이·폭이 있어야 숫자를 읽을 수 있다
export const BOOSTER_PANEL_W = 176;
export const BOOSTER_PANEL_H = 42;

// 화면에 보여줄 패널 전체 크기 ("남은시간" 라벨부터 "초"까지)
export const BOOSTER_PANEL_FULL = { w: 201, h: 54 };

// rgba(폭 w, 높이 h)에서 (px, py)를 패널 왼쪽 위로 보고 남은 초를 읽는다.
// 부스터 형식(XX.XX)이 아니거나(소수점 없음) 숫자를 하나라도 못 읽으면 null
export const readBoosterSeconds = (rgba, w, h, px, py) => {
  if (px < 0 || py < 0 || px + BOOSTER_PANEL_W > w || py + BOOSTER_PANEL_H > h) return null;
  const lit = (x, y) => {
    const i = ((py + y) * w + px + x) * 4;
    return isLit(rgba[i], rgba[i + 1], rgba[i + 2]);
  };
  if (!DECIMAL_POINT.every(([x, y]) => lit(x, y))) return null;
  let text = '';
  for (const x0 of DIGIT_CELLS) {
    const key = Object.keys(SEGMENTS)
      .filter((s) => SEGMENTS[s].some(([dx, y]) => lit(x0 + dx, y)))
      .join('');
    const digit = DIGITS[key];
    if (digit === undefined) return null;
    text += digit;
  }
  return Number(text) / 100;
};
