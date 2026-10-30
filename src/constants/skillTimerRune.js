// 미니맵의 룬 표시(11x11 마름모). 'P'=보라색 칸, 'K'=검은 테두리, 'W'=바깥쪽 밝은 테두리, '.'=배경(보지 않음).
// 화면 공유 영상은 색 정보를 2x2 픽셀 단위로 뭉개서(4:2:0) 1픽셀 테두리의 색이 주변과 섞이지만 밝기는 거의 그대로 남는다.
// 그래서 모양은 밝기로 보고, 색은 보라색 칸에서 "파랑이 초록보다 확실히 높다" 정도만 느슨하게 본다.
// prettier-ignore
const PATTERN = [
  '.....W.....',
  '....WKW....',
  '...WKPKW...',
  '..WKPPPKW..',
  '.WKPPPPPKW.',
  'WKPPPPPPPKW',
  '.WKPPPPPKW.',
  '..WKPPPKW..',
  '...WKPKW...',
  '....WKW....',
  '.....W.....',
];

export const RUNE_SIZE = PATTERN.length;

const points = { P: [], K: [], W: [] };
PATTERN.forEach((row, y) => {
  [...row].forEach((ch, x) => {
    if (points[ch]) points[ch].push([x, y]);
  });
});

const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
// 원본 보라색(#dd66ff)의 밝기는 약 155, 검은 테두리는 0, 바깥 테두리는 약 190~230
const isPurple = (r, g, b) => {
  const l = luma(r, g, b);
  return l > 95 && l < 225;
};
const isPurpleHue = (r, g, b) => b - g > 25 && r - g > 15;
const isDark = (r, g, b) => luma(r, g, b) < 90;
const isBright = (r, g, b) => luma(r, g, b) > 130;

// 이 비율 이상 패턴과 맞아야 룬으로 본다
const MIN_SCORE = 0.85;

// (lx, ly)를 왼쪽 위로 하는 11x11 칸이 룬 패턴과 얼마나 맞는지 0~1
const scoreAt = (rgba, w, lx, ly) => {
  const px = ([x, y]) => {
    const i = ((ly + y) * w + lx + x) * 4;
    return [rgba[i], rgba[i + 1], rgba[i + 2]];
  };
  let hit = 0;
  let hue = 0;
  for (const p of points.P) {
    const c = px(p);
    if (isPurple(...c)) hit++;
    if (isPurpleHue(...c)) hue++;
  }
  // 색이 뭉개져도 보라색 칸 대부분은 보라빛이 남는다. 다른 색 마름모(다른 표시)를 거른다
  if (hue < points.P.length * 0.7) return 0;
  for (const p of points.K) if (isDark(...px(p))) hit++;
  for (const p of points.W) if (isBright(...px(p))) hit++;
  return hit / (points.P.length + points.K.length + points.W.length);
};

// 영역(rgba, 폭 w, 높이 h)에서 룬을 찾는다. 반환: { found, score, x, y } (x, y는 영역 기준 왼쪽 위)
export const findRune = (rgba, w, h) => {
  let best = { found: false, score: 0, x: 0, y: 0 };
  const c = Math.floor(RUNE_SIZE / 2);
  for (let ly = 0; ly <= h - RUNE_SIZE; ly++) {
    for (let lx = 0; lx <= w - RUNE_SIZE; lx++) {
      // 가운데가 보라색이 아니면 바로 건너뛴다 (대부분의 위치가 여기서 걸러진다)
      const i = ((ly + c) * w + lx + c) * 4;
      if (!isPurple(rgba[i], rgba[i + 1], rgba[i + 2]) || !isPurpleHue(rgba[i], rgba[i + 1], rgba[i + 2])) continue;
      const score = scoreAt(rgba, w, lx, ly);
      if (score > best.score) best = { found: false, score, x: lx, y: ly };
    }
  }
  best.found = best.score >= MIN_SCORE;
  return best;
};
