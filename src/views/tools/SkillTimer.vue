<script setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
  import { useAppToast } from '@/composables/useAppToast';
  import { useSeo } from '@/composables/useSeo';

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

  let pollTimer = null;
  let resizeObserver = null;
  let ticking = false;
  let audioCtx = null;

  // 캐릭터나 스킬 이펙트가 잠깐 스킬을 가리는 경우를 걸러내기 위해 연속으로 안 보여야 사라진 것으로 판단
  const GONE_TICKS = 3;
  const SAMPLE_POINTS = 64;

  const captureCanvas = document.createElement('canvas');
  const captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });

  // 스킬 기준 이미지는 반응형으로 감쌀 필요가 없어 별도 저장소에 보관
  const templateStore = new Map(); // regionId -> { full, quick }

  const presets = ref([]);
  const showPresetDialog = ref(false);

  const STORAGE_KEY = 'skill-timer-config-v1';
  const ICON_BASE_URL = 'https://cdn.puter.us/images/skill-icon/';
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
        regions.push({
          id,
          name: saved.name,
          tplW: saved.tplW ?? w,
          tplH: saved.tplH ?? h,
          lastX: saved.lastX,
          lastY: saved.lastY,
          matchScore: 0,
          minMatchPercent: saved.minMatchPercent ?? 50,
          status: undefined,
          absentStreak: 0,
          paused: saved.paused ?? false,
          previewSrc: iconSrc,
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

  const notifyGone = (name) => {
    beep();
    toast.warn('스킬 사라짐', `"${name}" 스킬이 사라졌어요!`, 10000);
  };

  const testAlert = () => notifyGone('테스트 스킬');

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

  const matchRegion = (region, rgba, sa) => {
    const tpl = templateStore.get(region.id);
    if (!tpl) return;
    const tw = region.tplW;
    const th = region.tplH;
    const minMatch = region.minMatchPercent / 100;

    const found = findIcon(rgba, sa, tpl, tw, th, minMatch, region.lastX - sa.x, region.lastY - sa.y);
    region.matchScore = found.score;

    if (found.score >= minMatch) {
      region.lastX = found.lx + sa.x;
      region.lastY = found.ly + sa.y;
      region.status = 'present';
      region.absentStreak = 0;
      region.previewSrc = cropToDataUrl(captureCanvas, region.lastX, region.lastY, tw, th);
      return;
    }

    region.absentStreak += 1;
    region.previewSrc = cropToDataUrl(captureCanvas, region.lastX, region.lastY, tw, th);
    if (region.status === 'present' && region.absentStreak >= GONE_TICKS) {
      region.status = 'gone';
      notifyGone(region.name);
    }
  };

  const tick = async () => {
    if (ticking || !isSharing.value || !videoRef.value || !searchArea.value || regions.length === 0) return;
    ticking = true;
    try {
      const video = videoRef.value;
      if (!video.videoWidth) return;
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      captureCtx.drawImage(video, 0, 0);

      const sa = searchArea.value;
      const rgba = captureCtx.getImageData(sa.x, sa.y, sa.w, sa.h).data;

      for (const region of regions) {
        if (region.paused) continue;
        matchRegion(region, rgba, sa);
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

  const addSkillRegion = ({ name, tplW, tplH, template, previewSrc, initialX, initialY }) => {
    const id = regionSeq++;
    templateStore.set(id, template);
    regions.push({
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
      previewSrc,
      refPreviewSrc: previewSrc,
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
      addSkillRegion({ name: preset.name, tplW: w, tplH: h, template, previewSrc: src, initialX: sa.x, initialY: sa.y });
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
    persist();
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

  const statusLabel = (r) => {
    if (r.paused) return '일시정지';
    const match = `일치 ${Math.max(0, Math.round(r.matchScore * 100))}%`;
    if (r.status === 'present') return `떠 있음 (${match})`;
    if (r.status === 'gone') return `사라짐! (${match})`;
    return `아직 안 보임 (${match})`;
  };

  const statusSeverity = (r) => {
    if (r.paused) return 'secondary';
    if (r.status === 'present') return 'success';
    if (r.status === 'gone') return 'danger';
    return 'secondary';
  };

  onMounted(() => {
    restore();
    loadPresets();
  });

  onBeforeUnmount(() => {
    stopShare();
    templateStore.clear();
    audioCtx?.close();
  });
</script>

<template>
  <div class="flex">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">SkillTimer</div>
      <div class="flex flex-wrap items-center gap-2">
        <Button v-if="!isSharing" label="화면 공유 시작" icon="pi pi-desktop" @click="startShare" />
        <Button v-else label="화면 공유 중지" icon="pi pi-times" severity="danger" @click="stopShare" />
        <Button label="알림 테스트" icon="pi pi-bell" severity="secondary" outlined @click="testAlert" />
        <Button v-if="searchArea" label="스킬 선택" icon="pi pi-images" severity="secondary" outlined @click="openPresetPicker" />
        <Button v-if="searchArea" label="검색 영역 다시 지정" icon="pi pi-refresh" severity="secondary" outlined @click="resetSearchArea" />
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
        </template>
        <div v-if="selectRect" class="border-primary bg-primary/20 pointer-events-none absolute border-2 border-dashed" :style="selectRectStyle"></div>
      </div>
    </div>
  </div>

  <div class="mt-8 flex" v-if="regions.length">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">감시 중인 스킬</div>
      <div v-for="r in regions" :key="r.id" class="border-surface-200 flex flex-wrap items-center gap-3 border-b pb-4 last:border-0 last:pb-0">
        <div class="flex flex-col items-center gap-1">
          <span class="text-muted-color text-xs">기준</span>
          <img :src="r.refPreviewSrc" crossorigin="anonymous" alt="기준 스킬" class="border-surface-300 h-10 w-auto rounded border bg-black" />
        </div>
        <div class="flex flex-col items-center gap-1">
          <span class="text-muted-color text-xs">현재</span>
          <img v-if="r.previewSrc" :src="r.previewSrc" alt="현재 스킬" class="border-surface-300 h-10 w-auto rounded border bg-black" />
        </div>
        <InputText v-model="r.name" class="w-40" size="small" @blur="persist" />
        <Tag :value="statusLabel(r)" :severity="statusSeverity(r)" />
        <div class="flex items-center gap-2">
          <label class="text-muted-color text-xs">최소 일치도</label>
          <Slider v-model="r.minMatchPercent" :min="20" :max="95" class="w-32" @slideend="persist" />
          <span class="text-muted-color text-xs">{{ r.minMatchPercent }}%</span>
        </div>
        <div class="flex items-center gap-2 md:ml-auto">
          <Button :icon="r.paused ? 'pi pi-play' : 'pi pi-pause'" text rounded @click="togglePause(r)" />
          <Button icon="pi pi-trash" severity="danger" text rounded @click="removeRegion(r.id)" />
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
