<script setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
  import { useAppToast } from '@/composables/useAppToast';
  import { useSeo } from '@/composables/useSeo';
  import { DIGIT_STYLES } from '@/constants/skillTimerDigits';

  useSeo({
    title: 'Skill Timer',
    description: '화면을 공유하고 감시할 스킬을 등록하면, 그 스킬이 화면에서 사라졌을 때 소리로 알려줍니다.',
  });

  const toast = useAppToast();

  const videoRef = ref(null);
  const previewWrapRef = ref(null);

  const stream = ref(null);
  const isSharing = ref(false);
  const scale = ref(1);

  // 스킬이 표시되는 큰 영역. 비디오 원본 좌표 기준.
  const searchArea = ref(null);

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

  // 스킬별 알림 소리. DEFAULT_SOUND_ID = 기본 소리, 그 외는 CDN 소리 파일 id
  const DEFAULT_SOUND_ID = 'beep';
  const sounds = ref([]);
  const soundOptions = computed(() => [{ id: DEFAULT_SOUND_ID, name: '기본 소리' }, ...sounds.value]);
  // 여러 스킬이 동시에 알려도 서로 끊지 않도록 소리 파일마다 따로 재생
  const audioCache = new Map(); // src -> HTMLAudioElement
  const LEGACY_ICON_PATH = /^\/skill-timer-presets\//;

  const persist = () => {
    try {
      const payload = {
        searchArea: searchArea.value,
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
    const { data, width } = imgData;
    const opaque = [];
    for (let p = 0; p < width * imgData.height; p++) {
      if (data[p * 4 + 3] >= 128) opaque.push(p);
    }
    const step = Math.max(1, Math.floor(opaque.length / SAMPLE_POINTS));
    return {
      full: buildPointSet(data, width, opaque),
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
      if (!payload?.searchArea || !Array.isArray(payload.regions) || payload.regions.length === 0) return;

      searchArea.value = payload.searchArea;

      for (const saved of payload.regions) {
        // 예전에 로컬(public)에 있던 스킬 경로로 저장된 설정은 CDN 주소로 바꿔서 불러온다
        const iconSrc = saved.refPreviewSrc.replace(LEGACY_ICON_PATH, ICON_BASE_URL);
        const { template, w, h } = await loadImageTemplate(iconSrc);
        const id = regionSeq++;
        templateStore.set(id, template);
        // 숫자 종류가 저장되기 전의 설정은 기본 스킬 목록에서 같은 이미지를 찾아 채운다
        const preset = presets.value.find((p) => iconSrc.endsWith(`/${p.file}`));
        regions.push({
          ...counterState(),
          id,
          name: saved.name,
          tplW: saved.tplW ?? w,
          tplH: saved.tplH ?? h,
          lastX: saved.lastX,
          lastY: saved.lastY,
          matchScore: 0,
          minMatchPercent: saved.minMatchPercent ?? 50,
          counterType: saved.counterType ?? preset?.counter ?? null,
          alertBeforeSec: saved.alertBeforeSec ?? 0,
          alertAtCount: saved.alertAtCount ?? 0,
          // 목록에서 빠진 소리는 기본 소리로
          soundId: sounds.value.some((s) => s.id === saved.soundId) ? saved.soundId : DEFAULT_SOUND_ID,
          status: undefined,
          absentStreak: 0,
          paused: saved.paused ?? false,
          previewSrc: '',
          refPreviewSrc: iconSrc,
        });
      }

      persist();
      toast.info('저장된 설정을 불러왔어요', `스킬 ${regions.length}개를 복원했어요. 화면 공유를 시작하면 바로 감시해요.`);
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
  const findIcon = (rgba, sa, tpl, tw, th, minMatch, lastLx, lastLy) => {
    const inArea = (lx, ly) => lx >= 0 && ly >= 0 && lx + tw <= sa.w && ly + th <= sa.h;
    if (inArea(lastLx, lastLy)) {
      const atLast = colorNcc(rgba, sa.w, lastLx, lastLy, tpl.full);
      if (atLast >= minMatch) return { score: atLast, lx: lastLx, ly: lastLy };
    }

    const quickMin = minMatch - 0.2;
    let best = { score: 0, lx: lastLx, ly: lastLy };
    for (let ly = 0; ly <= sa.h - th; ly++) {
      for (let lx = 0; lx <= sa.w - tw; lx++) {
        if (colorNcc(rgba, sa.w, lx, ly, tpl.quick) < quickMin) continue;
        const score = colorNcc(rgba, sa.w, lx, ly, tpl.full);
        if (score > best.score) best = { score, lx, ly };
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

  const tick = async () => {
    if (ticking || !isSharing.value || !videoRef.value || !searchArea.value || regions.length === 0) return;
    ticking = true;
    try {
      const video = videoRef.value;
      if (!video.videoWidth) return;
      nowTick.value = Date.now();
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      captureCtx.drawImage(video, 0, 0);

      const sa = searchArea.value;
      const rgba = captureCtx.getImageData(sa.x, sa.y, sa.w, sa.h).data;

      for (const region of regions) {
        if (region.paused) continue;
        matchRegion(region, rgba, sa);
        checkTimedAlert(region);
      }
    } finally {
      ticking = false;
    }
  };

  const startShare = async () => {
    if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
      toast.error('지원하지 않는 브라우저', '화면 공유를 지원하지 않는 브라우저예요.');
      return;
    }

    ensureAudio();

    try {
      // 공유 선택창이 '창' 탭으로 열리도록 힌트 (게임 창을 바로 고를 수 있게)
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'window' }, audio: false });
      stream.value = s;
      isSharing.value = true;

      await nextTick();
      if (!videoRef.value) return;

      videoRef.value.srcObject = s;
      videoRef.value.onloadedmetadata = updateScale;
      await videoRef.value.play();
      updateScale();

      resizeObserver = new ResizeObserver(updateScale);
      resizeObserver.observe(videoRef.value);

      s.getVideoTracks()[0].addEventListener('ended', stopShare);

      pollTimer = setInterval(tick, 1200);
    } catch {
      toast.error('화면 공유 실패', '화면 공유 권한을 허용해야 사용할 수 있어요.');
      isSharing.value = false;
    }
  };

  const stopShare = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (stream.value) {
      stream.value.getTracks().forEach((t) => t.stop());
      stream.value = null;
    }
    isSharing.value = false;
    // 감시가 끝났으니 화면 공유 중에만 의미 있는 값(현재 모습, 상태, 일치도, 남은 시간/횟수)은 처음 상태로 되돌린다
    regions.forEach((r) => {
      Object.assign(r, counterState(), { previewSrc: '', status: undefined, matchScore: 0, absentStreak: 0 });
    });
  };

  const getRelPoint = (e) => {
    const rect = previewWrapRef.value.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onSelectStart = (e) => {
    if (!isSharing.value || searchArea.value) return;
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
      soundId: DEFAULT_SOUND_ID,
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

    searchArea.value = {
      x: Math.round(rect.x / scale.value),
      y: Math.round(rect.y / scale.value),
      w: Math.round(rect.w / scale.value),
      h: Math.round(rect.h / scale.value),
    };
    persist();
    toast.success('검색 영역 지정 완료', '이제 "스킬 선택"으로 감시할 스킬을 등록하세요.');
  };

  const onSelectCancel = () => {
    dragging.value = false;
    selectRect.value = null;
  };

  const resetSearchArea = () => {
    searchArea.value = null;
    regions.splice(0, regions.length);
    templateStore.clear();
    persist();
  };

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
    if (!searchArea.value) return {};
    const sa = searchArea.value;
    return {
      left: `${sa.x * scale.value}px`,
      top: `${sa.y * scale.value}px`,
      width: `${sa.w * scale.value}px`,
      height: `${sa.h * scale.value}px`,
    };
  });

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
      if (!res.ok) return;
      sounds.value = await res.json();
    } catch {
      // 소리 목록이 없으면 기본 소리만 사용
    }
  };

  const statusSeverity = (r) => {
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
        <Button v-if="!isSharing" label="화면 공유 시작" icon="pi pi-desktop" @click="startShare" />
        <Button v-else label="화면 공유 중지" icon="pi pi-times" severity="danger" @click="stopShare" />
        <Button v-if="searchArea" label="스킬 선택" icon="pi pi-images" severity="secondary" outlined @click="openPresetPicker" />
        <Button v-if="searchArea" label="초기화" icon="pi pi-refresh" severity="danger" outlined @click="resetSearchArea" />
      </div>
    </div>
  </div>

  <div class="mt-8 flex" v-if="isSharing">
    <div class="card flex w-full flex-col gap-4">
      <div
        ref="previewWrapRef"
        class="relative inline-block max-w-full select-none"
        :class="{ 'cursor-crosshair': !searchArea }"
        @mousedown="onSelectStart"
        @mousemove="onSelectMove"
        @mouseup="onSelectEnd"
        @mouseleave="onSelectCancel"
      >
        <video ref="videoRef" class="border-surface-300 block max-w-full rounded border" muted playsinline></video>
        <div v-if="searchArea" class="border-primary pointer-events-none absolute border-2 border-dashed" :style="searchAreaBoxStyle"></div>
        <template v-for="r in regions" :key="`box-${r.id}`">
          <div v-if="r.status === 'present'" class="pointer-events-none absolute border-2 border-green-500" :style="regionBoxStyle(r)"></div>
          <div v-else-if="r.status === 'hidden'" class="pointer-events-none absolute border-2 border-dashed border-amber-500" :style="regionBoxStyle(r)"></div>
        </template>
        <div v-if="selectRect" class="border-primary bg-primary/20 pointer-events-none absolute border-2 border-dashed" :style="selectRectStyle"></div>
      </div>
    </div>
  </div>

  <div class="mt-8 flex" v-if="regions.length">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">감시 중인 스킬</div>
      <div class="flex flex-col">
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
</style>
