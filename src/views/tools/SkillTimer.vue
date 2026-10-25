<script setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
  import { useAppToast } from '@/composables/useAppToast';
  import { useSeo } from '@/composables/useSeo';
  import { DIGIT_STYLES } from '@/constants/skillTimerDigits';
  import { RUNE_SIZE, createRuneReferenceImage, findRune } from '@/constants/skillTimerRune';

  useSeo({
    title: 'Skill Timer',
    description: '화면을 공유하고 감시할 스킬을 등록하면, 그 스킬이 화면에서 사라졌을 때 소리로 알려줍니다.',
  });

  const toast = useAppToast();

  // 감시는 화면에 보이지 않는 영상에서 읽는다 (검색 영역 모달을 닫아도 계속 감시하도록)
  const captureVideo = document.createElement('video');
  captureVideo.muted = true;
  captureVideo.playsInline = true;

  // 검색 영역 모달 안의 미리보기 영상
  const videoRef = ref(null);
  const previewWrapRef = ref(null);
  const showAreaDialog = ref(false);

  const stream = ref(null);
  const isSharing = ref(false);
  const isStarting = ref(false);
  const scale = ref(1);

  // 스킬이 표시되는 큰 영역. 비디오 원본 좌표 기준.
  const searchArea = ref(null);

  // 룬 알림: 미니맵 영역(비디오 원본 좌표)과 설정. 스킬 검색 영역과 따로 둔다
  const runeArea = ref(null);
  // 알림 방식과 반복 간격을 한 칸에서 고른다 (0 = 한 번만). 스킬 표처럼 알림 칸에 컨트롤 하나만 두려고 합쳤다
  const RUNE_REPEAT_SECONDS = [5, 10, 15, 20, 30, 45, 60];
  const runeAlertOptions = [{ value: 0, label: '한 번만' }, ...RUNE_REPEAT_SECONDS.map((sec) => ({ value: sec, label: `${sec}초마다` }))];
  const nearestRepeatSeconds = (sec) => RUNE_REPEAT_SECONDS.reduce((best, v) => (Math.abs(v - sec) < Math.abs(best - sec) ? v : best));
  const rune = reactive({
    enabled: true,
    mode: 'once', // 'once' = 나타날 때 한 번, 'repeat' = 떠 있는 동안 intervalSec마다
    intervalSec: 10,
    soundId: 'power-up', // RUNE_DEFAULT_SOUND_ID (소리 상수보다 먼저 만들어져서 값을 직접 적음)
  });
  // 룬 감시 중 상태 (저장하지 않음)
  const runeRuntimeState = () => ({
    status: undefined, // 'present' | 'absent'
    score: 0,
    x: 0, // 찾은 위치 (비디오 원본 좌표)
    y: 0,
    absentStreak: 0,
    alerted: false, // 이번에 나타난 룬을 이미 알렸는지
    lastAlertAt: 0,
    previewSrc: '',
  });
  const runeState = reactive(runeRuntimeState());
  const runeReferenceSrc = createRuneReferenceImage();

  // 검색 영역 모달이 다루는 대상: 'skill' = 스킬 검색 영역, 'rune' = 미니맵 영역
  const areaTarget = ref('skill');
  const activeArea = computed({
    get: () => (areaTarget.value === 'rune' ? runeArea.value : searchArea.value),
    set: (v) => {
      if (areaTarget.value === 'rune') runeArea.value = v;
      else searchArea.value = v;
    },
  });

  const regions = reactive([]);
  let regionSeq = 1;

  const dragging = ref(false);
  const dragOrigin = ref({ x: 0, y: 0 });
  const selectRect = ref(null);

  // 가려진 동안에도 남은 시간 표시가 줄어들도록 매 틱 갱신하는 현재 시각
  const nowTick = ref(Date.now());

  let pollTimer = null;
  let resizeObserver = null;
  let ticking = false;
  let audioCtx = null;

  // 캐릭터나 스킬 이펙트가 잠깐 스킬을 가리는 경우를 걸러내기 위해 연속으로 안 보여야 사라진 것으로 판단
  const GONE_TICKS = 3;
  const SAMPLE_POINTS = 64;
  // 버프 아이콘은 모두 비슷한 밝은 테두리가 있어서, 모양이 다른 아이콘끼리도 전체 일치도가 60%대까지 나온다.
  // 그래서 테두리(ICON_BORDER px)를 뺀 안쪽 일치도가 INNER_MIN_MATCH 이상일 때만 같은 스킬로 본다.
  // (다른 아이콘끼리는 안쪽 일치도가 최고 24%, 숫자가 겹친 같은 아이콘은 최저 45% 정도)
  const ICON_BORDER = 2;
  const INNER_MIN_MATCH = 0.3;
  // 숫자 템플릿과 이 픽셀 수까지 달라도 같은 숫자로 본다
  const GLYPH_TOLERANCE = 4;
  // 시간형: 남은 시간을 읽은 시점과 실제 종료 사이의 오차 여유
  const END_SLACK_MS = 1500;
  // 횟수형: 횟수가 남은 채로 가려진 상태가 이만큼 이어지면 그래도 알림 (숫자를 잘못 읽어 알림을 놓치는 것 방지)
  const HIDDEN_FALLBACK_MS = 30000;

  const captureCanvas = document.createElement('canvas');
  const captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });

  // 스킬 기준 이미지는 반응형으로 감쌀 필요가 없어 별도 저장소에 보관
  const templateStore = new Map(); // regionId -> { full, quick }

  const presets = ref([]);
  const showPresetDialog = ref(false);

  // 아이콘 숫자로 판단하기 위한 실행 중 상태 (저장하지 않음)
  const counterState = () => ({
    endsAt: null, // 시간형: 예상 종료 시각(ms)
    alertAt: null, // 시간형: 알림 시각(ms) = 종료 시각 - 알림 오프셋. 사라진 뒤에도 유지 (음수 오프셋은 종료 후 알림)
    count: null, // 횟수형: 마지막으로 읽은 남은 횟수
    alerted: false, // 이번 시전에서 이미 알렸는지 (한 번 시전에 한 번만 알림)
    zeroStreak: 0,
    hiddenSince: null,
  });

  const STORAGE_KEY = 'skill-timer-config-v1';
  const ICON_BASE_URL = 'https://cdn.puter.us/images/skill-icon/';
  const SOUND_BASE_URL = 'https://cdn.puter.us/sounds/';

  // 스킬별 알림 소리. DEFAULT_SOUND_ID = 기본 소리(파일 없이 만드는 삐 소리), 그 외는 CDN 소리 파일 id
  const DEFAULT_SOUND_ID = 'beep';
  // 처음 등록할 때 쓰는 소리. 목록(sounds.json)에 없으면 기본 소리
  const SKILL_DEFAULT_SOUND_ID = 'payment-success';
  const RUNE_DEFAULT_SOUND_ID = 'power-up';
  const sounds = ref([]);
  const soundOptions = computed(() => [{ id: DEFAULT_SOUND_ID, name: '기본 소리' }, ...sounds.value]);
  const hasSound = (id) => id === DEFAULT_SOUND_ID || sounds.value.some((s) => s.id === id);
  // 저장된 소리가 없거나 목록에서 빠졌으면 처음 기본값, 그것도 없으면 기본 소리
  const resolveSoundId = (id, fallback) => {
    if (hasSound(id)) return id;
    return hasSound(fallback) ? fallback : DEFAULT_SOUND_ID;
  };
  // 여러 스킬이 동시에 알려도 서로 끊지 않도록 소리 파일마다 따로 재생
  const audioCache = new Map(); // src -> HTMLAudioElement
  const LEGACY_ICON_PATH = /^\/skill-timer-presets\//;

  const persist = () => {
    try {
      const payload = {
        searchArea: searchArea.value,
        runeArea: runeArea.value,
        rune: { enabled: rune.enabled, mode: rune.mode, intervalSec: rune.intervalSec, soundId: rune.soundId },
        regions: regions.map((r) => ({
          name: r.name,
          tplW: r.tplW,
          tplH: r.tplH,
          lastX: r.lastX,
          lastY: r.lastY,
          minMatchPercent: r.minMatchPercent,
          paused: r.paused,
          counterType: r.counterType,
          alertBeforeSec: r.alertBeforeSec,
          alertAtCount: r.alertAtCount,
          soundId: r.soundId,
          refPreviewSrc: r.refPreviewSrc,
        })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // 저장 실패(용량 초과 등)는 무시
    }
  };

  // 픽셀 목록을 채널(R,G,B)별로 평균을 뺀 값으로 미리 계산해 둔다 (정규화 상관 계산용)
  const buildPointSet = (data, width, pixels) => {
    const n = pixels.length;
    const xs = new Int32Array(n);
    const ys = new Int32Array(n);
    pixels.forEach((p, i) => {
      xs[i] = p % width;
      ys[i] = Math.floor(p / width);
    });
    const centered = [];
    const variance = [];
    for (let c = 0; c < 3; c++) {
      let mean = 0;
      for (const p of pixels) mean += data[p * 4 + c];
      mean /= n;
      const tc = new Float32Array(n);
      let v = 0;
      pixels.forEach((p, i) => {
        tc[i] = data[p * 4 + c] - mean;
        v += tc[i] * tc[i];
      });
      centered.push(tc);
      variance.push(v);
    }
    return { n, xs, ys, centered, variance };
  };

  // 투명한 픽셀(스킬 배경)은 비교에서 빼고, 빠른 1차 거르기용 표본 픽셀도 따로 뽑아둔다
  const buildTemplate = (imgData) => {
    const { data, width, height } = imgData;
    const opaque = [];
    for (let p = 0; p < width * height; p++) {
      if (data[p * 4 + 3] >= 128) opaque.push(p);
    }
    const inner = opaque.filter((p) => {
      const x = p % width;
      const y = Math.floor(p / width);
      return x >= ICON_BORDER && y >= ICON_BORDER && x < width - ICON_BORDER && y < height - ICON_BORDER;
    });
    const step = Math.max(1, Math.floor(opaque.length / SAMPLE_POINTS));
    return {
      full: buildPointSet(data, width, opaque),
      inner: buildPointSet(data, width, inner),
      quick: buildPointSet(
        data,
        width,
        opaque.filter((_, i) => i % step === 0)
      ),
    };
  };

  const loadImageTemplate = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const c = document.createElement('canvas');
        c.width = image.naturalWidth;
        c.height = image.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(image, 0, 0);
        resolve({ template: buildTemplate(ctx.getImageData(0, 0, c.width, c.height)), w: c.width, h: c.height });
      };
      image.onerror = reject;
      // CDN 이미지의 픽셀을 읽으려면(getImageData) CORS 요청으로 불러와야 한다
      image.crossOrigin = 'anonymous';
      image.src = src;
    });

  const restore = async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload) return;

      // 검색 영역과 스킬은 따로 저장된다 (영역을 다시 지정하는 중이면 영역 없이 스킬만 있을 수 있음)
      searchArea.value = payload.searchArea ?? null;
      runeArea.value = payload.runeArea ?? null;
      if (payload.rune) {
        rune.enabled = payload.rune.enabled ?? true;
        rune.mode = payload.rune.mode === 'repeat' ? 'repeat' : 'once';
        rune.intervalSec = nearestRepeatSeconds(payload.rune.intervalSec ?? 10);
        rune.soundId = resolveSoundId(payload.rune.soundId, RUNE_DEFAULT_SOUND_ID);
      }
      if (!Array.isArray(payload.regions) || payload.regions.length === 0) return;

      for (const saved of payload.regions) {
        // 예전에 로컬(public)에 있던 스킬 경로로 저장된 설정은 CDN 주소로 바꿔서 불러온다
        const iconSrc = saved.refPreviewSrc.replace(LEGACY_ICON_PATH, ICON_BASE_URL);
        // 이미지를 못 불러와도(CDN 오류 등) 목록에서 빼면 다음 저장 때 설정이 지워지므로, 실패로 표시만 하고 남겨둔다
        let loaded = null;
        try {
          loaded = await loadImageTemplate(iconSrc);
        } catch {
          // 아래에서 loadFailed로 표시
        }
        const id = regionSeq++;
        if (loaded) templateStore.set(id, loaded.template);
        // 숫자 종류가 저장되기 전의 설정은 기본 스킬 목록에서 같은 이미지를 찾아 채운다
        const preset = presets.value.find((p) => iconSrc.endsWith(`/${p.file}`));
        regions.push({
          ...counterState(),
          id,
          name: saved.name,
          tplW: saved.tplW ?? loaded?.w,
          tplH: saved.tplH ?? loaded?.h,
          lastX: saved.lastX,
          lastY: saved.lastY,
          matchScore: 0,
          minMatchPercent: saved.minMatchPercent ?? 50,
          counterType: saved.counterType ?? preset?.counter ?? null,
          alertBeforeSec: saved.alertBeforeSec ?? 0,
          alertAtCount: saved.alertAtCount ?? 0,
          // 목록에서 빠진 소리는 기본 소리로
          soundId: resolveSoundId(saved.soundId, SKILL_DEFAULT_SOUND_ID),
          status: undefined,
          absentStreak: 0,
          paused: saved.paused ?? false,
          previewSrc: '',
          refPreviewSrc: iconSrc,
          loadFailed: !loaded,
        });
      }

      persist();
      const next = searchArea.value ? '화면 공유를 시작하면 바로 감시해요.' : '화면 공유 후 검색 영역을 지정하면 감시를 시작해요.';
      toast.info('저장된 설정을 불러왔어요', `스킬 ${regions.length}개를 복원했어요. ${next}`);
      const failed = regions.filter((r) => r.loadFailed).length;
      if (failed) toast.warn('스킬 이미지를 불러오지 못했어요', `${failed}개는 감시하지 않아요. 설정은 남겨뒀으니 새로고침하면 다시 시도해요.`);
    } catch {
      // 복원 실패는 무시
    }
  };

  // 브라우저 자동재생 정책 때문에, 사용자가 버튼을 누른 순간에 오디오를 미리 깨워둔다
  const ensureAudio = () => {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch {
      audioCtx = null;
    }
  };

  const beep = (times = 3) => {
    ensureAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    for (let i = 0; i < times; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.connect(gain).connect(audioCtx.destination);
      const t = now + i * 0.45;
      osc.start(t);
      osc.stop(t + 0.3);
    }
  };

  // 선택한 소리 파일을 재생한다. 파일이 없거나 재생에 실패하면 기본 소리
  const playAlertSound = (soundId) => {
    const sound = sounds.value.find((s) => s.id === soundId);
    if (!sound) {
      beep();
      return;
    }
    const src = `${SOUND_BASE_URL}${sound.file}`;
    let audio = audioCache.get(src);
    if (!audio) {
      audio = new Audio(src);
      audioCache.set(src, audio);
    }
    audio.currentTime = 0;
    audio.play().catch(() => beep());
  };

  const onSoundChange = (region) => {
    persist();
    playAlertSound(region.soundId);
  };

  // 한 번 시전에 한 번만 알린다 (소리만)
  const alertRegion = (region) => {
    if (region.alerted) return;
    region.alerted = true;
    region.alertAt = null;
    playAlertSound(region.soundId);
  };

  // 시간형은 아이콘이 보이든 가려졌든 사라졌든 설정한 시각이 되면 알린다
  const checkTimedAlert = (region) => {
    if (region.counterType === 'time' && region.alertAt && !region.alerted && Date.now() >= region.alertAt) alertRegion(region);
  };

  const updateScale = () => {
    if (videoRef.value && videoRef.value.videoWidth) {
      scale.value = videoRef.value.clientWidth / videoRef.value.videoWidth;
    }
  };

  const cropToDataUrl = (source, x, y, w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(source, x, y, w, h, 0, 0, w, h);
    return c.toDataURL('image/png');
  };

  // 검색 영역 RGBA 버퍼(rgba, saW 폭)의 (lx,ly) 위치와 기준 이미지의 일치도 (1=완전 일치, 0 이하=무관)
  // R,G,B 채널별 정규화 상관을 평균낸다. 밝기를 일정 비율로 낮춰도(버프 스킬이 어두워져도) 값이 거의 그대로 유지되고,
  // 색이 다른 스킬(파란 스킬 vs 노란 스킬)은 잘 구분된다.
  const colorNcc = (rgba, saW, lx, ly, pts) => {
    const { n, xs, ys, centered, variance } = pts;
    let total = 0;
    let channels = 0;
    for (let c = 0; c < 3; c++) {
      if (variance[c] <= 1) continue;
      const tc = centered[c];
      let sI = 0;
      let sI2 = 0;
      let sIT = 0;
      for (let i = 0; i < n; i++) {
        const v = rgba[((ly + ys[i]) * saW + lx + xs[i]) * 4 + c];
        sI += v;
        sI2 += v * v;
        sIT += v * tc[i];
      }
      const vI = sI2 - (sI * sI) / n;
      channels++;
      if (vI > 1) total += sIT / Math.sqrt(vI * variance[c]);
    }
    return channels ? total / channels : 0;
  };

  // 직전 위치에 그대로 있으면 바로 끝내고, 없으면 영역 전체를 1px 단위로 찾는다 (스킬은 1px만 어긋나도 값이 크게 떨어짐).
  // 표본 픽셀로 먼저 대충 비교해서 확실히 아닌 위치는 건너뛴다.
  // 테두리를 뺀 안쪽이 닮지 않은 위치(다른 스킬 아이콘)는 전체 일치도가 높아도 후보에서 뺀다.
  const findIcon = (rgba, sa, tpl, tw, th, minMatch, lastLx, lastLy) => {
    const innerMatches = (lx, ly) => colorNcc(rgba, sa.w, lx, ly, tpl.inner) >= INNER_MIN_MATCH;
    const inArea = (lx, ly) => lx >= 0 && ly >= 0 && lx + tw <= sa.w && ly + th <= sa.h;
    if (inArea(lastLx, lastLy)) {
      const atLast = colorNcc(rgba, sa.w, lastLx, lastLy, tpl.full);
      if (atLast >= minMatch && innerMatches(lastLx, lastLy)) return { score: atLast, lx: lastLx, ly: lastLy };
    }

    const quickMin = minMatch - 0.2;
    let best = { score: 0, lx: lastLx, ly: lastLy };
    for (let ly = 0; ly <= sa.h - th; ly++) {
      for (let lx = 0; lx <= sa.w - tw; lx++) {
        if (colorNcc(rgba, sa.w, lx, ly, tpl.quick) < quickMin) continue;
        const score = colorNcc(rgba, sa.w, lx, ly, tpl.full);
        if (score > best.score && innerMatches(lx, ly)) best = { score, lx, ly };
      }
    }
    return best;
  };

  // 아이콘 위 숫자를 읽는다. 숫자 색 픽셀이 이어진 세로줄 묶음을 한 글자로 보고 템플릿과 비교.
  // 반환: 읽은 문자열('' = 숫자 없음), 모르는 모양이 섞이면 null
  const readDigits = (rgba, saW, lx, ly, style) => {
    const { box, isInk, glyphs } = DIGIT_STYLES[style];
    const ink = (x, y) => {
      const i = ((ly + y) * saW + lx + x) * 4;
      return isInk(rgba[i], rgba[i + 1], rgba[i + 2]);
    };
    const colHasInk = (x) => {
      for (let y = box.y0; y <= box.y1; y++) if (ink(x, y)) return true;
      return false;
    };

    let text = '';
    let x = box.x0;
    while (x <= box.x1) {
      if (!colHasInk(x)) {
        x++;
        continue;
      }
      let end = x;
      while (end <= box.x1 && colHasInk(end)) end++;

      const rows = [];
      for (let y = box.y0; y <= box.y1; y++) {
        let row = '';
        for (let c = x; c < end; c++) row += ink(c, y) ? '#' : '.';
        rows.push(row);
      }
      const glyph = rows.join('/');

      let best = null;
      let bestDist = Infinity;
      for (const [ch, list] of Object.entries(glyphs)) {
        for (const t of list) {
          if (t.length !== glyph.length) continue;
          let d = 0;
          for (let i = 0; i < t.length; i++) if (t[i] !== glyph[i]) d++;
          if (d < bestDist) {
            bestDist = d;
            best = ch;
          }
        }
      }
      if (bestDist > GLYPH_TOLERANCE) return null;
      text += best;
      x = end;
    }
    return text;
  };

  // 시간형은 남은 초, 횟수형은 남은 횟수를 돌려준다. 못 읽으면 null
  const readCounter = (rgba, sa, lx, ly, region) => {
    if (!region.counterType || region.tplW !== 32 || region.tplH !== 32) return null;
    const text = readDigits(rgba, sa.w, lx, ly, region.counterType);
    if (text === null) return null;
    if (region.counterType === 'time') {
      const mmss = text.match(/^(\d{1,2}):(\d{2})$/);
      if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
      return /^\d{1,3}$/.test(text) ? Number(text) : null;
    }
    // 횟수가 0이 되면 숫자만 사라지고 아이콘은 남는다
    if (text === '') return 0;
    return /^\d{1,2}$/.test(text) ? Number(text) : null;
  };

  const markGone = (region) => {
    region.status = 'gone';
    region.endsAt = null;
    region.hiddenSince = null;
    // 시간형은 알림 시각에 맞춰 따로 알린다 (음수 설정이면 사라진 뒤에 알림). 시각을 모르면(숫자를 못 읽음) 지금 알림
    if (region.counterType === 'time' && region.alertAt) return;
    alertRegion(region);
  };

  const matchRegion = (region, rgba, sa) => {
    const tpl = templateStore.get(region.id);
    if (!tpl) return;
    const tw = region.tplW;
    const th = region.tplH;
    const minMatch = region.minMatchPercent / 100;
    const now = Date.now();

    const found = findIcon(rgba, sa, tpl, tw, th, minMatch, region.lastX - sa.x, region.lastY - sa.y);
    region.matchScore = found.score;

    if (found.score >= minMatch) {
      region.lastX = found.lx + sa.x;
      region.lastY = found.ly + sa.y;
      region.absentStreak = 0;
      region.hiddenSince = null;
      region.previewSrc = cropToDataUrl(captureCanvas, region.lastX, region.lastY, tw, th);

      // 사라졌던 스킬이 다시 보이면 새로 시전한 것 → 다음 알림 준비
      if (region.status === 'gone') region.alerted = false;

      const value = readCounter(rgba, sa, found.lx, found.ly, region);
      if (region.counterType === 'time' && value !== null) {
        const endsAt = now + value * 1000;
        // 남은 시간이 다시 늘어났다 = 재시전
        if (region.endsAt && endsAt > region.endsAt + 2000) region.alerted = false;
        region.endsAt = endsAt;
        region.alertAt = endsAt - region.alertBeforeSec * 1000;
      }

      if (region.counterType === 'count' && value !== null) {
        if (value === 0 && region.count >= 1) {
          // 숫자가 사라졌다 = 횟수를 다 씀. 잠깐 가려져 숫자만 안 보이는 경우를 걸러내려고 2번 연속 확인
          region.zeroStreak += 1;
          if (region.zeroStreak >= 2) {
            region.count = 0;
            markGone(region);
          } else {
            region.status = 'present';
          }
          return;
        }
        region.zeroStreak = 0;
        // 횟수를 다 쓴 아이콘이 그대로 떠 있는 동안은 '사라짐' 상태 유지
        if (value === 0 && region.count === 0 && region.status === 'gone') return;
        // 남은 횟수가 다시 늘어났다 = 재시전
        if (region.count !== null && value > region.count) region.alerted = false;
        region.count = value;
        if (region.alertAtCount > 0 && value <= region.alertAtCount) alertRegion(region);
      }

      region.status = 'present';
      return;
    }

    region.absentStreak += 1;
    region.previewSrc = cropToDataUrl(captureCanvas, region.lastX, region.lastY, tw, th);
    if (region.status !== 'present' && region.status !== 'hidden') return;
    region.hiddenSince ??= now;

    // 숫자로 남은 양을 알면, 남아 있는 동안 안 보이는 건 인벤토리 창/이펙트에 가려진 것으로 본다
    let gone;
    if (region.counterType === 'time' && region.endsAt) {
      gone = now >= region.endsAt - END_SLACK_MS;
    } else if (region.counterType === 'count' && region.count !== null) {
      gone = region.count <= 1 ? region.absentStreak >= 2 : now - region.hiddenSince >= HIDDEN_FALLBACK_MS;
    } else {
      gone = region.absentStreak >= GONE_TICKS;
    }

    if (gone) markGone(region);
    else region.status = 'hidden';
  };

  // 마지막으로 찾은 위치에서 이만큼(px, 비디오 원본 기준)보다 많이 떨어진 곳에 보이면 다른 룬으로 본다
  const RUNE_MOVE_PX = 3;

  // 룬은 캐릭터 표시가 잠깐 겹쳐도 사라진 것으로 보지 않도록, 스킬과 같이 연속으로 안 보여야 사라진 것으로 본다
  const checkRune = (rgba, ra) => {
    const now = Date.now();
    const found = findRune(rgba, ra.w, ra.h);
    runeState.score = found.score;
    if (found.found) {
      const x = found.x + ra.x;
      const y = found.y + ra.y;
      // 맵을 옮기면 로딩이 짧아 "사라짐"(연속 GONE_TICKS번)까지 안 가므로, 다른 위치에 보이면 새 룬으로 보고 다시 알린다
      if (runeState.alerted && (Math.abs(x - runeState.x) > RUNE_MOVE_PX || Math.abs(y - runeState.y) > RUNE_MOVE_PX)) runeState.alerted = false;
      runeState.status = 'present';
      runeState.absentStreak = 0;
      runeState.x = x;
      runeState.y = y;
      runeState.previewSrc = cropToDataUrl(captureCanvas, runeState.x, runeState.y, RUNE_SIZE, RUNE_SIZE);
      const repeatDue = rune.mode === 'repeat' && now - runeState.lastAlertAt >= rune.intervalSec * 1000;
      if (!runeState.alerted || repeatDue) {
        runeState.alerted = true;
        runeState.lastAlertAt = now;
        playAlertSound(rune.soundId);
      }
      return;
    }
    runeState.absentStreak++;
    if (runeState.absentStreak >= GONE_TICKS) {
      // 사라지면 알림 없이 다음에 나타날 룬을 기다린다
      runeState.status = 'absent';
      runeState.alerted = false;
      runeState.previewSrc = '';
    }
  };

  const tick = async () => {
    const watchSkills = !!searchArea.value && regions.length > 0;
    const watchRune = !!runeArea.value && rune.enabled;
    if (ticking || !isSharing.value || (!watchSkills && !watchRune)) return;
    ticking = true;
    try {
      const video = captureVideo;
      if (!video.videoWidth) return;
      nowTick.value = Date.now();
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      captureCtx.drawImage(video, 0, 0);

      if (watchSkills) {
        const sa = searchArea.value;
        const rgba = captureCtx.getImageData(sa.x, sa.y, sa.w, sa.h).data;
        for (const region of regions) {
          if (region.paused) continue;
          matchRegion(region, rgba, sa);
          checkTimedAlert(region);
        }
      }

      if (watchRune) {
        const ra = runeArea.value;
        checkRune(captureCtx.getImageData(ra.x, ra.y, ra.w, ra.h).data, ra);
      }
    } finally {
      ticking = false;
    }
  };

  const startShare = async () => {
    // 공유할 창을 고르는 동안 버튼을 또 누르면 공유와 감시가 두 개씩 생긴다
    if (isStarting.value || isSharing.value) return;
    if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
      toast.error('지원하지 않는 브라우저', '화면 공유를 지원하지 않는 브라우저예요.');
      return;
    }

    ensureAudio();
    isStarting.value = true;

    let s;
    try {
      // 공유 선택창이 '창' 탭으로 열리도록 힌트 (게임 창을 바로 고를 수 있게)
      s = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'window' }, audio: false });
    } catch {
      toast.error('화면 공유 실패', '화면 공유 권한을 허용해야 사용할 수 있어요.');
      isStarting.value = false;
      return;
    }

    try {
      stream.value = s;
      isSharing.value = true;

      captureVideo.srcObject = s;
      await captureVideo.play();

      s.getVideoTracks()[0].addEventListener('ended', stopShare);

      pollTimer = setInterval(tick, 1200);

      // 처음이라 검색 영역이 없으면 바로 지정하도록 연다
      if (!searchArea.value && !runeArea.value) openAreaDialog('skill');
    } catch {
      // 권한은 받았지만 영상 재생 등에서 실패: 잡아둔 화면 공유를 놓아준다
      stopShare();
      toast.error('화면 공유 실패', '화면 공유를 시작하지 못했어요. 다시 시도해주세요.');
    } finally {
      isStarting.value = false;
    }
  };

  const stopShare = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (stream.value) {
      stream.value.getTracks().forEach((t) => t.stop());
      stream.value = null;
    }
    captureVideo.srcObject = null;
    showAreaDialog.value = false;
    isSharing.value = false;
    // 감시가 끝났으니 화면 공유 중에만 의미 있는 값은 처음 상태로 되돌린다
    resetRegionRuntime();
    Object.assign(runeState, runeRuntimeState());
  };

  // 화면을 보고 얻은 값(현재 모습, 상태, 일치도, 남은 시간/횟수)만 처음 상태로 되돌린다. 저장되는 설정은 그대로
  const resetRegionRuntime = () => {
    regions.forEach((r) => {
      Object.assign(r, counterState(), { previewSrc: '', status: undefined, matchScore: 0, absentStreak: 0 });
    });
  };

  const getRelPoint = (e) => {
    const rect = previewWrapRef.value.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onSelectStart = (e) => {
    if (!isSharing.value || activeArea.value) return;
    dragging.value = true;
    dragOrigin.value = getRelPoint(e);
    selectRect.value = { x: dragOrigin.value.x, y: dragOrigin.value.y, w: 0, h: 0 };
  };

  const onSelectMove = (e) => {
    if (!dragging.value) return;
    const p = getRelPoint(e);
    selectRect.value = {
      x: Math.min(p.x, dragOrigin.value.x),
      y: Math.min(p.y, dragOrigin.value.y),
      w: Math.abs(p.x - dragOrigin.value.x),
      h: Math.abs(p.y - dragOrigin.value.y),
    };
  };

  const addSkillRegion = ({ name, tplW, tplH, template, iconSrc, initialX, initialY, counterType }) => {
    const id = regionSeq++;
    templateStore.set(id, template);
    regions.push({
      ...counterState(),
      counterType: counterType ?? null,
      alertBeforeSec: 0,
      alertAtCount: 0,
      soundId: resolveSoundId(SKILL_DEFAULT_SOUND_ID, SKILL_DEFAULT_SOUND_ID),
      id,
      name: name || `스킬 ${regions.length + 1}`,
      tplW,
      tplH,
      lastX: initialX,
      lastY: initialY,
      matchScore: 0,
      minMatchPercent: 50,
      status: undefined,
      absentStreak: 0,
      paused: false,
      previewSrc: '',
      refPreviewSrc: iconSrc,
    });
    persist();
  };

  const loadPresets = async () => {
    try {
      const res = await fetch('/skill-timer-presets/manifest.json');
      if (!res.ok) return;
      presets.value = await res.json();
    } catch {
      // 기본 스킬 목록이 없으면 무시
    }
  };

  const openPresetPicker = () => {
    if (!searchArea.value) {
      toast.warn('검색 영역을 먼저 지정하세요', '기본 스킬을 등록하기 전에 화면 공유 후 검색 영역을 먼저 지정해주세요.');
      return;
    }
    showPresetDialog.value = true;
  };

  const registerFromPreset = async (preset) => {
    try {
      const src = `${ICON_BASE_URL}${preset.file}`;
      const { template, w, h } = await loadImageTemplate(src);
      const sa = searchArea.value;
      addSkillRegion({ name: preset.name, tplW: w, tplH: h, template, iconSrc: src, initialX: sa.x, initialY: sa.y, counterType: preset.counter });
      showPresetDialog.value = false;
      toast.success('등록 완료', `"${preset.name}" 스킬을 등록했어요. 화면에 보이면 자동으로 찾아서 감시해요.`);
    } catch {
      toast.error('불러오지 못했어요', '기본 스킬 이미지를 불러오는 데 실패했어요.');
    }
  };

  const onSelectEnd = () => {
    if (!dragging.value) return;
    dragging.value = false;

    const rect = selectRect.value;
    selectRect.value = null;
    if (!rect || rect.w < 8 || rect.h < 8 || !scale.value) return;

    activeArea.value = {
      x: Math.round(rect.x / scale.value),
      y: Math.round(rect.y / scale.value),
      w: Math.round(rect.w / scale.value),
      h: Math.round(rect.h / scale.value),
    };
    persist();
    if (areaTarget.value === 'rune') toast.success('미니맵 영역 지정 완료', '이 영역에서 룬을 찾아요.');
    else if (regions.length) toast.success('검색 영역 지정 완료', `등록된 스킬 ${regions.length}개를 이 영역에서 찾아요.`);
    else toast.success('검색 영역 지정 완료', '이제 "스킬 선택"으로 감시할 스킬을 등록하세요.');
  };

  const onSelectCancel = () => {
    dragging.value = false;
    selectRect.value = null;
  };

  // 지정한 검색 영역을 끌어서 옮기거나(move) 모서리·변을 끌어 크기를 바꾼다(n/s/e/w 조합). 좌표는 비디오 원본 기준
  const AREA_MIN_SIZE = 32; // 스킬 아이콘(32px)보다 작으면 찾을 수 없다
  const AREA_HANDLES = [
    { mode: 'nw', class: '-left-1.5 -top-1.5 cursor-nwse-resize' },
    { mode: 'n', class: 'left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize' },
    { mode: 'ne', class: '-right-1.5 -top-1.5 cursor-nesw-resize' },
    { mode: 'e', class: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
    { mode: 'se', class: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
    { mode: 's', class: 'left-1/2 -bottom-1.5 -translate-x-1/2 cursor-ns-resize' },
    { mode: 'sw', class: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
    { mode: 'w', class: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
  ];
  let areaEdit = null; // { mode, startX, startY, orig }

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  const onAreaEditMove = (e) => {
    if (!areaEdit || !scale.value) return;
    const { mode, startX, startY, orig } = areaEdit;
    const dx = (e.clientX - startX) / scale.value;
    const dy = (e.clientY - startY) / scale.value;
    const vw = captureVideo.videoWidth;
    const vh = captureVideo.videoHeight;

    if (mode === 'move') {
      activeArea.value = {
        ...orig,
        x: Math.round(clamp(orig.x + dx, 0, vw - orig.w)),
        y: Math.round(clamp(orig.y + dy, 0, vh - orig.h)),
      };
      return;
    }

    let x1 = orig.x;
    let y1 = orig.y;
    let x2 = orig.x + orig.w;
    let y2 = orig.y + orig.h;
    if (mode.includes('w')) x1 = clamp(x1 + dx, 0, x2 - AREA_MIN_SIZE);
    if (mode.includes('e')) x2 = clamp(x2 + dx, x1 + AREA_MIN_SIZE, vw);
    if (mode.includes('n')) y1 = clamp(y1 + dy, 0, y2 - AREA_MIN_SIZE);
    if (mode.includes('s')) y2 = clamp(y2 + dy, y1 + AREA_MIN_SIZE, vh);
    activeArea.value = { x: Math.round(x1), y: Math.round(y1), w: Math.round(x2 - x1), h: Math.round(y2 - y1) };
  };

  const onAreaEditEnd = () => {
    window.removeEventListener('pointermove', onAreaEditMove);
    window.removeEventListener('pointerup', onAreaEditEnd);
    if (!areaEdit) return;
    areaEdit = null;
    persist();
  };

  const onAreaEditStart = (e, mode) => {
    if (!activeArea.value) return;
    e.preventDefault();
    areaEdit = { mode, startX: e.clientX, startY: e.clientY, orig: { ...activeArea.value } };
    // 영역 밖으로 빠르게 끌어도 놓치지 않도록 창 전체에서 받는다
    window.addEventListener('pointermove', onAreaEditMove);
    window.addEventListener('pointerup', onAreaEditEnd);
  };

  // 모달이 열리면 미리보기 영상에 같은 화면 공유를 연결하고, 닫히면 끊는다
  const onAreaDialogShow = async () => {
    await nextTick();
    const video = videoRef.value;
    if (!video || !stream.value) return;
    video.srcObject = stream.value;
    video.onloadedmetadata = updateScale;
    await video.play().catch(() => {});
    updateScale();
    resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(video);
  };

  const onAreaDialogHide = () => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (videoRef.value) videoRef.value.srcObject = null;
    onSelectCancel();
    onAreaEditEnd();
  };

  // 검색 영역만 다시 지정한다. 스킬은 매번 영역 전체에서 다시 찾으므로 등록된 스킬과 설정은 그대로 둔다
  const resetSearchArea = () => {
    searchArea.value = null;
    resetRegionRuntime();
    persist();
  };

  // 모달의 "다시 그리기": 지금 다루는 영역만 비운다
  const clearActiveArea = () => {
    if (areaTarget.value === 'rune') {
      runeArea.value = null;
      Object.assign(runeState, runeRuntimeState());
      persist();
    } else {
      resetSearchArea();
    }
  };

  const openAreaDialog = (target) => {
    areaTarget.value = target;
    showAreaDialog.value = true;
  };

  const onRuneEnabledChange = (enabled) => {
    rune.enabled = enabled;
    // 다시 켜면 지금 떠 있는 룬도 바로 알리도록 처음 상태에서 시작
    Object.assign(runeState, runeRuntimeState());
    persist();
  };

  const runeAlertValue = computed({
    get: () => (rune.mode === 'repeat' ? rune.intervalSec : 0),
    set: (v) => {
      if (v > 0) {
        rune.mode = 'repeat';
        rune.intervalSec = v;
      } else {
        rune.mode = 'once';
      }
      persist();
    },
  });

  const onRuneSoundChange = () => {
    persist();
    playAlertSound(rune.soundId);
  };

  // 스킬 표와 같은 말과 색으로 상태를 보여준다
  const runeStatusLabel = computed(() => {
    if (!rune.enabled) return '중지';
    if (runeState.status === 'present') return runeState.absentStreak > 0 ? `찾는 중 ${runeState.absentStreak}/${GONE_TICKS}` : '인식 중';
    return '대기 중';
  });

  const runeStatusSeverity = computed(() => {
    if (!rune.enabled) return 'secondary';
    if (runeState.status === 'present') return runeState.absentStreak > 0 ? 'warn' : 'success';
    return 'secondary';
  });

  const runeHint = computed(() => (rune.mode === 'repeat' ? `떠 있는 동안 ${runeAlertOptions.find((o) => o.value === rune.intervalSec)?.label ?? ''}` : '나타날 때 한 번'));

  const removeRegion = (id) => {
    const idx = regions.findIndex((r) => r.id === id);
    if (idx !== -1) regions.splice(idx, 1);
    templateStore.delete(id);
    openDetails.delete(id);
    persist();
  };

  // 상세 설정(최소 일치도·소리)을 펼친 스킬 id. 여러 개를 동시에 펼칠 수 있고 저장하지 않는다
  const openDetails = reactive(new Set());
  const toggleDetail = (id) => {
    if (openDetails.has(id)) openDetails.delete(id);
    else openDetails.add(id);
  };

  const onAlertSettingChange = (region) => {
    region.alertBeforeSec ??= 0;
    region.alertAtCount ??= 0;
    if (region.counterType === 'time' && region.endsAt && !region.alerted) region.alertAt = region.endsAt - region.alertBeforeSec * 1000;
    persist();
  };

  const alertHint = (r) => {
    if (r.counterType === 'time') {
      const sec = r.alertBeforeSec ?? 0;
      if (sec > 0) return `끝나기 ${sec}초 전`;
      if (sec < 0) return `끝나고 ${-sec}초 후`;
      return '끝날 때';
    }
    return (r.alertAtCount ?? 0) > 0 ? `${r.alertAtCount}회 남았을 때` : '다 썼을 때';
  };

  const togglePause = (region) => {
    region.paused = !region.paused;
    persist();
  };

  const searchAreaBoxStyle = computed(() => {
    if (!activeArea.value) return {};
    const sa = activeArea.value;
    return {
      left: `${sa.x * scale.value}px`,
      top: `${sa.y * scale.value}px`,
      width: `${sa.w * scale.value}px`,
      height: `${sa.h * scale.value}px`,
    };
  });

  const runeBoxStyle = computed(() => ({
    left: `${runeState.x * scale.value}px`,
    top: `${runeState.y * scale.value}px`,
    width: `${RUNE_SIZE * scale.value}px`,
    height: `${RUNE_SIZE * scale.value}px`,
  }));

  const regionBoxStyle = (r) => ({
    left: `${r.lastX * scale.value}px`,
    top: `${r.lastY * scale.value}px`,
    width: `${r.tplW * scale.value}px`,
    height: `${r.tplH * scale.value}px`,
  });

  const selectRectStyle = computed(() => {
    if (!selectRect.value) return {};
    const { x, y, w, h } = selectRect.value;
    return { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` };
  });

  const formatSeconds = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}초`);

  const remainingLabel = (r) => {
    if (r.counterType === 'time' && r.endsAt) return `${formatSeconds(Math.max(0, Math.round((r.endsAt - nowTick.value) / 1000)))} 남음`;
    if (r.counterType === 'count' && r.count !== null) return `${r.count}회 남음`;
    return '';
  };

  const statusLabel = (r) => {
    if (r.loadFailed) return '이미지 불러오기 실패';
    if (r.paused) return '중지';
    const remain = remainingLabel(r);
    if (r.status === 'present') return remain ? `인식 중 · ${remain}` : '인식 중';
    if (r.status === 'hidden') {
      if (remain) return `찾는 중 · ${r.counterType === 'count' ? `마지막 ${remain}` : `약 ${remain}`}`;
      return `찾는 중 ${r.absentStreak}/${GONE_TICKS}`;
    }
    if (r.status === 'gone') return r.counterType === 'count' && r.count === 0 ? '횟수 소진!' : '대기 중';
    return '대기 중';
  };

  const loadSounds = async () => {
    try {
      const res = await fetch('/skill-timer-presets/sounds.json');
      if (res.ok) sounds.value = await res.json();
    } catch {
      // 소리 목록이 없으면 기본 소리만 사용
    }
    // 룬 알림은 저장된 설정이 없을 때도 처음 기본 소리가 목록에 있는지 맞춰둔다
    rune.soundId = resolveSoundId(rune.soundId, RUNE_DEFAULT_SOUND_ID);
  };

  const statusSeverity = (r) => {
    if (r.loadFailed) return 'danger';
    if (r.paused) return 'secondary';
    if (r.status === 'present') return 'success';
    if (r.status === 'hidden') return 'warn';
    if (r.status === 'gone') return 'danger';
    return 'secondary';
  };

  onMounted(async () => {
    // 저장된 설정에 숫자 종류와 소리를 채우려면 기본 스킬·소리 목록이 먼저 있어야 한다
    await Promise.all([loadPresets(), loadSounds()]);
    await restore();
  });

  onBeforeUnmount(() => {
    stopShare();
    onAreaEditEnd();
    templateStore.clear();
    audioCtx?.close();
    audioCache.forEach((audio) => audio.pause());
    audioCache.clear();
  });
</script>

<template>
  <div class="flex">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">SkillTimer</div>
      <div class="flex flex-wrap items-center gap-2">
        <Button v-if="!isSharing" label="화면 공유 시작" icon="pi pi-desktop" :loading="isStarting" @click="startShare" />
        <Button v-else label="화면 공유 중지" icon="pi pi-times" severity="danger" @click="stopShare" />
      </div>
    </div>
  </div>

  <!-- 스킬을 등록하려면 화면 공유 중이어야 하므로, 등록된 스킬이 없어도 공유 중이면 보여준다 -->
  <div class="mt-8 flex" v-if="regions.length || isSharing">
    <div class="card flex w-full flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-xl font-semibold">스킬 알림</div>
        <div class="flex flex-wrap items-center gap-2">
          <Button v-if="isSharing && searchArea" label="스킬 선택" icon="pi pi-images" severity="secondary" outlined :class="{ 'breathe-hint': !regions.length }" @click="openPresetPicker" />
          <Button v-if="isSharing" label="검색 영역 설정" icon="pi pi-expand" severity="secondary" outlined @click="openAreaDialog('skill')" />
        </div>
      </div>
      <div v-if="!regions.length" class="text-muted-color text-sm">
        {{ searchArea ? '"스킬 선택"으로 감시할 스킬을 등록하세요.' : '"검색 영역 설정"에서 스킬이 표시되는 곳을 먼저 지정하세요.' }}
      </div>
      <div v-else class="flex flex-col">
        <!-- 모든 줄이 같은 열 너비를 쓰도록 제목줄과 각 줄에 같은 grid 템플릿을 사용 (모바일은 줄바꿈 배치) -->
        <div class="skill-row text-muted-color border-surface-200 hidden border-b pb-2 text-xs font-medium">
          <span>감시</span>
          <span>기준 / 현재</span>
          <span>이름</span>
          <span>상태</span>
          <span>알림</span>
          <span></span>
        </div>
        <div v-for="r in regions" :key="r.id" class="skill-row border-surface-200 flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
          <label class="flex cursor-pointer items-center gap-2">
            <ToggleSwitch :modelValue="!r.paused" aria-label="감시" @update:modelValue="togglePause(r)" />
            <span class="text-xs font-medium" :class="r.paused ? 'text-muted-color' : 'text-color'">{{ r.paused ? '꺼짐' : '켜짐' }}</span>
          </label>
          <div class="flex items-center gap-1.5">
            <img :src="r.refPreviewSrc" crossorigin="anonymous" alt="기준 스킬" title="기준" class="border-surface-300 h-10 w-10 rounded border bg-black" />
            <i class="pi pi-angle-right text-muted-color text-xs"></i>
            <img v-if="r.previewSrc" :src="r.previewSrc" alt="현재 스킬" title="현재" class="border-surface-300 h-10 w-10 rounded border bg-black" />
            <div v-else class="border-surface-300 text-muted-color flex h-10 w-10 items-center justify-center rounded border border-dashed text-xs" title="화면 공유 중에만 표시돼요">-</div>
          </div>

          <InputText v-model="r.name" class="skill-name w-40" size="small" @blur="persist" />

          <div class="flex flex-col items-start gap-1">
            <Tag :value="statusLabel(r)" :severity="statusSeverity(r)" />
            <span class="text-muted-color text-xs">일치 {{ Math.max(0, Math.round(r.matchScore * 100)) }}%</span>
          </div>

          <div v-if="r.counterType" class="flex flex-col items-start gap-1">
            <div class="flex items-center gap-2">
              <span class="text-muted-color skill-mlabel text-xs">알림</span>
              <InputNumber
                v-if="r.counterType === 'time'"
                v-model="r.alertBeforeSec"
                :min="-5"
                :max="20"
                showButtons
                buttonLayout="horizontal"
                size="small"
                :inputStyle="{ width: '3rem', textAlign: 'center' }"
                @update:modelValue="onAlertSettingChange(r)"
              />
              <InputNumber
                v-else
                v-model="r.alertAtCount"
                :min="0"
                :max="10"
                showButtons
                buttonLayout="horizontal"
                size="small"
                :inputStyle="{ width: '3rem', textAlign: 'center' }"
                @update:modelValue="onAlertSettingChange(r)"
              />
              <span class="text-muted-color text-xs">{{ r.counterType === 'time' ? '초 전' : '회 남음' }}</span>
            </div>
            <span class="text-muted-color text-xs">{{ alertHint(r) }} 알림</span>
          </div>
          <span v-else class="text-muted-color text-xs">사라지면 알림</span>

          <div class="skill-actions ml-auto flex items-center justify-end gap-1">
            <Button
              icon="pi pi-sliders-h"
              :severity="openDetails.has(r.id) ? 'primary' : 'secondary'"
              text
              rounded
              v-tooltip.top="'상세 설정'"
              aria-label="상세 설정"
              :aria-expanded="openDetails.has(r.id)"
              @click="toggleDetail(r.id)"
            />
            <Button icon="pi pi-trash" severity="danger" text rounded v-tooltip.top="'삭제'" @click="removeRegion(r.id)" />
          </div>

          <div v-if="openDetails.has(r.id)" class="skill-detail bg-surface-50 dark:bg-surface-800 flex w-full flex-wrap items-start gap-x-10 gap-y-4 rounded-lg px-4 py-3">
            <div class="flex flex-col gap-1.5">
              <span class="text-muted-color text-xs font-medium">최소 일치도</span>
              <div class="flex items-center gap-3">
                <Slider v-model="r.minMatchPercent" :min="20" :max="95" class="w-40" @slideend="persist" />
                <span class="w-9 text-right text-sm">{{ r.minMatchPercent }}%</span>
              </div>
              <span class="text-muted-color text-xs">낮추면 잘 찾지만, 비슷한 다른 아이콘을 잘못 찾을 수 있어요</span>
            </div>
            <div class="flex flex-col gap-1.5">
              <span class="text-muted-color text-xs font-medium">소리</span>
              <div class="flex items-center gap-1">
                <Select v-model="r.soundId" :options="soundOptions" option-label="name" option-value="id" size="small" class="w-44" aria-label="알림 소리" @change="onSoundChange(r)" />
                <Button v-tooltip.top="'소리 미리 듣기'" icon="pi pi-volume-up" severity="secondary" text rounded size="small" aria-label="소리 미리 듣기" @click="playAlertSound(r.soundId)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 미니맵 영역을 지정하려면 화면 공유 중이어야 하므로, 영역이 없어도 공유 중이면 보여준다 -->
  <div class="mt-8 flex" v-if="runeArea || isSharing">
    <div class="card flex w-full flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-xl font-semibold">룬 알림</div>
        <Button v-if="isSharing" label="미니맵 영역 설정" icon="pi pi-map" severity="secondary" outlined @click="openAreaDialog('rune')" />
      </div>
      <div v-if="!runeArea" class="text-muted-color text-sm">"미니맵 영역 설정"에서 미니맵이 보이는 곳을 지정하세요.</div>
      <div v-else class="flex flex-col">
        <!-- 스킬 알림 표와 같은 grid 템플릿(skill-row)을 써서 두 표의 열을 맞춘다 -->
        <div class="skill-row text-muted-color border-surface-200 hidden border-b pb-2 text-xs font-medium">
          <span>감시</span>
          <span>기준 / 현재</span>
          <span>이름</span>
          <span>상태</span>
          <span>알림</span>
          <span></span>
        </div>
        <div class="skill-row flex flex-wrap items-center gap-3 py-3">
          <label class="flex cursor-pointer items-center gap-2">
            <ToggleSwitch :modelValue="rune.enabled" aria-label="룬 알림" @update:modelValue="onRuneEnabledChange" />
            <span class="text-xs font-medium" :class="rune.enabled ? 'text-color' : 'text-muted-color'">{{ rune.enabled ? '켜짐' : '꺼짐' }}</span>
          </label>
          <div class="flex items-center gap-1.5">
            <img :src="runeReferenceSrc" alt="기준 룬" title="기준" class="border-surface-300 h-10 w-10 rounded border bg-black [image-rendering:pixelated]" />
            <i class="pi pi-angle-right text-muted-color text-xs"></i>
            <img v-if="runeState.previewSrc" :src="runeState.previewSrc" alt="현재 룬" title="현재" class="border-surface-300 h-10 w-10 rounded border bg-black [image-rendering:pixelated]" />
            <div v-else class="border-surface-300 text-muted-color flex h-10 w-10 items-center justify-center rounded border border-dashed text-xs" title="룬을 찾으면 표시돼요">-</div>
          </div>

          <span class="skill-name w-40 text-sm font-medium">룬</span>

          <div class="flex flex-col items-start gap-1">
            <Tag :value="runeStatusLabel" :severity="runeStatusSeverity" />
            <span class="text-muted-color text-xs">일치 {{ Math.round(runeState.score * 100) }}%</span>
          </div>

          <div class="flex flex-col items-start gap-1">
            <div class="flex items-center gap-2">
              <span class="text-muted-color skill-mlabel text-xs">알림</span>
              <Select v-model="runeAlertValue" :options="runeAlertOptions" option-label="label" option-value="value" size="small" class="w-32" aria-label="룬 알림 방식" />
            </div>
            <span class="text-muted-color text-xs">{{ runeHint }} 알림</span>
          </div>

          <div class="skill-actions ml-auto flex items-center justify-end gap-1">
            <Button
              icon="pi pi-sliders-h"
              :severity="openDetails.has('rune') ? 'primary' : 'secondary'"
              text
              rounded
              v-tooltip.top="'상세 설정'"
              aria-label="상세 설정"
              :aria-expanded="openDetails.has('rune')"
              @click="toggleDetail('rune')"
            />
          </div>

          <div v-if="openDetails.has('rune')" class="skill-detail bg-surface-50 dark:bg-surface-800 flex w-full flex-wrap items-start gap-x-10 gap-y-4 rounded-lg px-4 py-3">
            <div class="flex flex-col gap-1.5">
              <span class="text-muted-color text-xs font-medium">소리</span>
              <div class="flex items-center gap-1">
                <Select v-model="rune.soundId" :options="soundOptions" option-label="name" option-value="id" size="small" class="w-44" aria-label="룬 알림 소리" @change="onRuneSoundChange" />
                <Button v-tooltip.top="'소리 미리 듣기'" icon="pi pi-volume-up" severity="secondary" text rounded size="small" aria-label="소리 미리 듣기" @click="playAlertSound(rune.soundId)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Dialog
    v-model:visible="showAreaDialog"
    :header="areaTarget === 'rune' ? '미니맵 영역 설정' : '스킬 검색 영역 설정'"
    modal
    :draggable="false"
    :style="{ width: '75rem' }"
    :breakpoints="{ '1280px': '95vw' }"
    @show="onAreaDialogShow"
    @hide="onAreaDialogHide"
  >
    <div class="flex flex-col gap-3">
      <div class="text-muted-color text-sm">
        <template v-if="activeArea">영역을 끌어서 옮기거나, 모서리·변의 점을 끌어 크기를 바꿀 수 있어요.</template>
        <template v-else-if="areaTarget === 'rune'">미니맵이 보이는 곳을 드래그해서 영역을 지정하세요. 미니맵 전체가 들어가도록 넉넉하게 잡아주세요.</template>
        <template v-else>스킬이 표시되는 곳을 드래그해서 검색 영역을 지정하세요.</template>
      </div>
      <div
        ref="previewWrapRef"
        class="relative inline-block max-w-full select-none"
        :class="{ 'cursor-crosshair': !activeArea }"
        @mousedown="onSelectStart"
        @mousemove="onSelectMove"
        @mouseup="onSelectEnd"
        @mouseleave="onSelectCancel"
      >
        <video ref="videoRef" class="border-surface-300 block max-h-[70vh] max-w-full rounded border" muted playsinline></video>
        <div
          v-if="activeArea"
          class="border-primary absolute cursor-move touch-none border-2 border-dashed"
          :style="searchAreaBoxStyle"
          title="끌어서 옮기기"
          @pointerdown.stop="onAreaEditStart($event, 'move')"
          @mousedown.stop
        >
          <span
            v-for="h in AREA_HANDLES"
            :key="h.mode"
            class="border-primary bg-surface-0 absolute h-3 w-3 rounded-sm border-2"
            :class="h.class"
            @pointerdown.stop="onAreaEditStart($event, h.mode)"
          ></span>
        </div>
        <template v-for="r in areaTarget === 'skill' ? regions : []" :key="`box-${r.id}`">
          <div v-if="r.status === 'present'" class="pointer-events-none absolute border-2 border-green-500" :style="regionBoxStyle(r)"></div>
          <div v-else-if="r.status === 'hidden'" class="pointer-events-none absolute border-2 border-dashed border-amber-500" :style="regionBoxStyle(r)"></div>
        </template>
        <div v-if="areaTarget === 'rune' && runeState.status === 'present'" class="pointer-events-none absolute border-2 border-green-500" :style="runeBoxStyle"></div>
        <div v-if="selectRect" class="border-primary bg-primary/20 pointer-events-none absolute border-2 border-dashed" :style="selectRectStyle"></div>
      </div>
    </div>
    <template #footer>
      <Button v-if="activeArea" label="다시 그리기" icon="pi pi-refresh" severity="secondary" outlined @click="clearActiveArea" />
      <Button label="완료" icon="pi pi-check" @click="showAreaDialog = false" />
    </template>
  </Dialog>

  <Dialog v-model:visible="showPresetDialog" header="스킬 선택" modal :style="{ width: '44rem' }" :breakpoints="{ '768px': '95vw' }">
    <div v-if="!presets.length" class="text-muted-color text-sm">아직 등록된 스킬이 없어요.</div>
    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      <button
        v-for="p in presets"
        :key="p.id"
        type="button"
        class="border-surface-200 dark:border-surface-700 hover:border-primary hover:bg-surface-100 dark:hover:bg-surface-800 flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 transition-colors"
        @click="registerFromPreset(p)"
      >
        <img :src="`${ICON_BASE_URL}${p.file}`" crossorigin="anonymous" :alt="p.name" class="h-16 w-16 [image-rendering:pixelated]" />
        <span class="text-color text-center text-sm leading-snug font-medium break-keep">{{ p.name }}</span>
      </button>
    </div>
  </Dialog>
</template>

<style scoped>
  /* 사이드바를 빼면 표 형태 6칸이 들어갈 폭이 1280px부터라, 그 아래는 줄바꿈 배치.
     이 프로젝트의 Tailwind xl은 1200px이라 xl: 클래스를 섞으면 전환 시점이 어긋나므로, 표 전환은 여기서만 처리한다 */
  @media (min-width: 1280px) {
    /* 감시 | 아이콘 | 이름 | 상태 | 알림 | 상세·삭제 (상세 설정은 다음 줄에 전체 폭으로)
       내용에 따라 열 너비가 달라지면 제목줄과 각 줄이 어긋나므로, 고정 폭과 비율(minmax(0, fr))만 사용 */
    .skill-row {
      display: grid;
      /* 이름은 최대 14rem까지만 늘고, 남는 폭은 알림 칸이 가져간다 (버튼은 오른쪽 끝) */
      grid-template-columns: 5rem 7rem minmax(0, 14rem) 11rem minmax(11rem, 1fr) 4.5rem;
      column-gap: 1.25rem;
      align-items: center;
    }

    .skill-name {
      width: calc(100% - 1.5rem);
      max-width: 11rem;
    }

    .skill-mlabel {
      display: none;
    }

    .skill-actions {
      margin-left: 0;
    }

    .skill-detail {
      grid-column: 1 / -1;
      margin-top: 0.75rem;
    }
  }

  /* 영역만 지정하고 스킬이 없을 때 다음에 누를 "스킬 선택" 버튼을 숨 쉬듯 강조 */
  .breathe-hint {
    --breathe-color: var(--primary-color);
    --breathe-base-border: var(--surface-border);
    animation: breathe 2s ease-in-out infinite;
  }

  @keyframes breathe {
    0%,
    100% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--breathe-color) 0%, transparent);
      border-color: var(--breathe-base-border);
    }
    50% {
      box-shadow: 0 0 0 6px color-mix(in srgb, var(--breathe-color) 30%, transparent);
      border-color: var(--breathe-color);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .breathe-hint {
      animation: none;
      border-color: var(--breathe-color);
    }
  }
</style>
