// ============================================================
// JOJO BIZARRE ARENA 2D — Beta v2.1
// Jotaro vs DIO vs Yoshikage Kira
// ============================================================

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d", { alpha: false });
const arenaContainer = document.getElementById("arena-container");

const ARENA_PAD = 12;
const BASE_WORLD_H = 680;
const MIN_WORLD_W = 1180;
let WORLD_W = 1680;
let WORLD_H = 780;
let ARENA_LEFT = ARENA_PAD;
let ARENA_TOP = ARENA_PAD;
let ARENA_RIGHT = WORLD_W - ARENA_PAD;
let ARENA_BOTTOM = WORLD_H - ARENA_PAD;
let ARENA_W = ARENA_RIGHT - ARENA_LEFT;
let ARENA_H = ARENA_BOTTOM - ARENA_TOP;
let ARENA_CX = WORLD_W / 2;
let ARENA_CY = WORLD_H / 2;

let state = null;
let arenaFloorCache = null;
let arenaFloorCacheDirty = true;
const GRAPHICS_STORAGE_KEY = "jojoGraphicsMode";
let graphicsMode = "normal";
try {
  const savedGraphicsMode = localStorage.getItem(GRAPHICS_STORAGE_KEY);
  if (savedGraphicsMode === "high") graphicsMode = "high";
} catch (error) {
  console.warn("Unable to read saved graphics mode:", error);
}
let targetFrameInterval = 1000 / (graphicsMode === "high" ? 120 : 60);
let lastRenderTime = 0;
const ARENA_MAP_PATHS = Array.from({ length: 15 }, (_, index) => `Map/${index + 1}.png`);
let currentArenaMapPath = null;
let arenaMapImage = null;
let arenaMapRequestId = 0;

function selectRandomArenaMap() {
  const choices = ARENA_MAP_PATHS.filter((path) => path !== currentArenaMapPath);
  const selectedPath = choices[Math.floor(Math.random() * choices.length)] || ARENA_MAP_PATHS[0];
  const requestId = ++arenaMapRequestId;
  currentArenaMapPath = selectedPath;
  arenaMapImage = null;
  arenaFloorCacheDirty = true;

  if (arenaMapLabel) {
    const mapNumber = selectedPath.match(/(\d+)\.png$/)?.[1] || "1";
    arenaMapLabel.textContent = `BATTLEFIELD ${mapNumber.padStart(2, "0")}`;
  }

  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    if (requestId !== arenaMapRequestId) return;
    arenaMapImage = image;
    arenaFloorCacheDirty = true;
  };
  image.onerror = () => {
    if (requestId !== arenaMapRequestId) return;
    console.error(`Unable to load arena map: ${selectedPath}`);
    arenaFloorCacheDirty = true;
  };
  image.src = encodeURI(selectedPath);
  return selectedPath;
}

function isTouchDeviceOrSmallScreen() {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth <= 960
  );
}

function syncArenaSize() {
  if (!arenaContainer) return;
  const rect = arenaContainer.getBoundingClientRect();
  let cssW = Math.floor(rect.width);
  let cssH = Math.floor(rect.height);
  if (cssW < 320 || cssH < 200) {
    cssW = Math.max(cssW, window.innerWidth);
    cssH = Math.max(cssH, window.innerHeight - 70);
  }
  cssW = Math.max(320, cssW);
  cssH = Math.max(200, cssH);
  const aspect = cssW / cssH;
  const isMobile = isTouchDeviceOrSmallScreen();
  targetFrameInterval = 1000 / (graphicsMode === "high" ? 120 : 60);

  // Slightly larger character-to-map ratio on mobile screens so fighters are crisp & balanced
  let worldH = isMobile ? 560 : BASE_WORLD_H;
  const minW = isMobile ? 980 : MIN_WORLD_W;
  let worldW = Math.round(worldH * aspect);
  if (worldW < minW) {
    worldW = minW;
    worldH = Math.round(worldW / aspect);
  }

  const dpr = isMobile
    ? Math.min(window.devicePixelRatio || 1, graphicsMode === "high" ? 1.35 : 1)
    : Math.min(window.devicePixelRatio || 1, graphicsMode === "high" ? 1.75 : 1.25);
  const maxCanvasPixels = isMobile
    ? (graphicsMode === "high" ? 1800000 : 1200000)
    : (graphicsMode === "high" ? 6000000 : 3600000);
  const requestedW = cssW * dpr;
  const requestedH = cssH * dpr;
  const pixelScale = Math.min(1, Math.sqrt(maxCanvasPixels / (requestedW * requestedH)));
  const backingW = Math.max(480, Math.round(requestedW * pixelScale));
  const backingH = Math.max(260, Math.round(requestedH * pixelScale));

  if (
    canvas.width !== backingW ||
    canvas.height !== backingH ||
    WORLD_W !== worldW ||
    WORLD_H !== worldH
  ) {
    canvas.width = backingW;
    canvas.height = backingH;
    WORLD_W = worldW;
    WORLD_H = worldH;
    arenaFloorCacheDirty = true;
  }

  ARENA_LEFT = ARENA_PAD;
  ARENA_TOP = ARENA_PAD;
  ARENA_RIGHT = WORLD_W - ARENA_PAD;
  ARENA_BOTTOM = WORLD_H - ARENA_PAD;
  ARENA_W = ARENA_RIGHT - ARENA_LEFT;
  ARENA_H = ARENA_BOTTOM - ARENA_TOP;
  ARENA_CX = WORLD_W / 2;
  ARENA_CY = WORLD_H / 2;

  if (state) {
    for (const f of [state.p1, state.p2]) {
      f.x = Math.max(ARENA_LEFT + f.radius, Math.min(ARENA_RIGHT - f.radius, f.x));
      f.y = Math.max(ARENA_TOP + f.radius, Math.min(ARENA_BOTTOM - f.radius, f.y));
    }
  }
}

window.addEventListener("resize", syncArenaSize);
window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    if (typeof syncMobileControlsVisibility === "function") syncMobileControlsVisibility();
    syncArenaSize();
    requestAnimationFrame(syncArenaSize);
  }, 120);
});
if (typeof ResizeObserver !== "undefined" && arenaContainer) {
  new ResizeObserver(syncArenaSize).observe(arenaContainer);
}
syncArenaSize();

const MAX_HP = 300;
const MAX_GUARD_POOL = 25;
const GUARD_FULL_RECHARGE_SECONDS = 40;
const GUARD_LOCK_SECONDS = 4; // 4s lock on shield break
const DASH_COOLDOWN = 4;

const AI_DIFFICULTIES = {
  easy: {
    id: "easy",
    label: "DỄ",
    hudTag: "AI DỄ",
    desc: "Cơ bản, ra chiêu chậm — Phù hợp cho người mới tập chơi",
    hpBonus: 0,
    dmgMult: 1.0,
    maxSpeed: 195,
    accel: 520,
    decisionMin: 0.48,
    decisionMax: 0.78,
    guardChance: 0.2,
    dashChance: 0.2,
    skillChance: 0.55,
    reflexChance: 0.2,
    comboChance: 0.18,
    leadAim: 0,
    startDelayQ: 11,
    startDelayE: 3.5,
    startDelayR: 5.0,
  },
  medium: {
    id: "medium",
    label: "TRUNG BÌNH",
    hudTag: "AI TB",
    desc: "Bắt đầu khó dần — Biết đỡ đòn, lướt & né chiêu cơ bản",
    hpBonus: 0,
    dmgMult: 1.0,
    maxSpeed: 230,
    accel: 700,
    decisionMin: 0.24,
    decisionMax: 0.4,
    guardChance: 0.55,
    dashChance: 0.6,
    skillChance: 0.8,
    reflexChance: 0.45,
    comboChance: 0.38,
    leadAim: 0.14,
    startDelayQ: 9,
    startDelayE: 2.5,
    startDelayR: 4.0,
  },
  hard: {
    id: "hard",
    label: "KHÓ",
    hudTag: "AI KHÓ",
    desc: "Kỹ năng cao, phản xạ nhanh • +50 Máu AI",
    hpBonus: 50,
    dmgMult: 1.0,
    maxSpeed: 255,
    accel: 860,
    decisionMin: 0.13,
    decisionMax: 0.22,
    guardChance: 0.85,
    dashChance: 0.9,
    skillChance: 0.95,
    reflexChance: 0.72,
    comboChance: 0.62,
    leadAim: 0.22,
    startDelayQ: 7,
    startDelayE: 2.0,
    startDelayR: 3.5,
  },
  super: {
    id: "super",
    label: "SIÊU KHÓ",
    hudTag: "SIÊU AI",
    desc: "🔥 Siêu AI đỉnh cao: Combo liên hoàn & né chiêu • +200 Máu • +20% Sát thương",
    hpBonus: 200,
    dmgMult: 1.2,
    maxSpeed: 280,
    accel: 1180,
    decisionMin: 0.055,
    decisionMax: 0.095,
    guardChance: 1.0,
    dashChance: 1.0,
    skillChance: 1.0,
    reflexChance: 1.0,
    comboChance: 1.0,
    leadAim: 0.3,
    startDelayQ: 4.5,
    startDelayE: 1.0,
    startDelayR: 2.0,
  },
};

// ── Assets ──────────────────────────────────────────────────
function encodePath(path) {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function loadImage(path) {
  const img = new Image();
  img.src = encodePath(path);
  return img;
}

const _mipCache = new WeakMap();
function getMipSprite(img, maxDim) {
  if (!img || !img.complete || img.naturalWidth <= 0) return null;
  if (Math.max(img.naturalWidth, img.naturalHeight) <= maxDim) return img;
  let perSize = _mipCache.get(img);
  if (!perSize) {
    perSize = new Map();
    _mipCache.set(img, perSize);
  }
  let cached = perSize.get(maxDim);
  if (cached) return cached;

  const scale = maxDim / Math.max(img.naturalWidth, img.naturalHeight);
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.round(img.naturalWidth * scale));
  off.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const octx = off.getContext("2d");
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(img, 0, 0, off.width, off.height);
  perSize.set(maxDim, off);
  return off;
}

const ASSETS = {
  jotaro: loadImage("Jotaro/Jotaro_with_stand.png"),
  dio: loadImage("Dio/dio_with_stand.png"),
  kira: loadImage("killerqueen/kira_with_stand.png"),
  diavolo: loadImage("Diavolo/Diavolo_with_stand.webp"),
  okuyasu: loadImage("The hand/Okuyasu_with_stand.webp"),
  josuke: loadImage("Josuke/Josuke_with_stand.webp"),
  polnareff: loadImage("Polnareff/Polnareff_with_stand.webp"),
  polnareffArmorOff: loadImage("Polnareff/Polnareff_with_stand (Silver Chariot Armor Off).webp"),
  jolyne: loadImage("Jolyne/Jolyne_with_stand.webp"),
  jolyneSkillQ: loadImage("Jolyne/Jolyne_skillQ.webp"),
  armSP: loadImage("Jotaro/arm_star_platinum.png"),
  armTW: loadImage("Dio/arm_the_world.png"),
  armKQ: loadImage("killerqueen/arm_killer_queen.png"),
  roadRoller: loadImage("Dio/road_roller.png"),
  theHandEraseVfx: loadImage("The hand/the_hand_erase_vfx.webp"),
  josukeRock: loadImage("Josuke/rock_throw.webp"),
  josukeAngelo: loadImage("Josuke/Angelo_stone.webp"),
  polnareffSwordProj: loadImage("Polnareff/projectile_sword.webp"),
  jolyneWeb: loadImage("Jolyne/spider_web.webp"),
};

// ── Audio Manager ───────────────────────────────────────────
const SOUNDS = {
  jotaroBarrage: { file: "Jotaro/jotaro barrage.mp3", gain: 1.35 },
  jotaroStarFinger: { file: "Jotaro/jotaro star_finger.mp3", gain: 1.35 },
  jotaroZaWarudo: { file: "Jotaro/jotaro_zawarudo.mp3", gain: 1.85 },
  dioBarrage: { file: "Dio/dio Barrage.mp3", gain: 0.9 },
  dioRoadRoller: { file: "Dio/ROAD ROLLER DA!!!.mp3", gain: 4.8 },
  dioTimeStop: { file: "Dio/Dio_time_stop.mp3", gain: 1.0 },
  dioLaugh: { file: "Dio/Dio Laughing.mp3", gain: 0.65 },
  dioGreatestHigh: { file: "Dio/THIS IS THE GREATEST HIGH (Dio.mp3", gain: 0.65 },
  kiraBarrage: { file: "killerqueen/killerqueen_barrage.mp3", gain: 1.35 },
  kiraDetonate: { file: "killerqueen/Killer Queen Detonate.mp3", gain: 1.3 },
  kiraSwitch: { file: "killerqueen/Killer Queen First Bomb Switch.mp3", gain: 1.3 },
  kiraBiteTheDust: { file: "killerqueen/KillerQueen_BiteTheDust.mp3", gain: 1.85 },
  kiraExploded: { file: "killerqueen/EXPLODED.mp3", gain: 1.45 },
  diavoloBarrage: { file: "Diavolo/Diavolo_skill R.mp3", gain: 3.6 },
  diavoloTimeSkip: { file: "Diavolo/Kingcrimson_skill E.mp3", gain: 3.6 },
  diavoloEpitaph: { file: "Diavolo/Diavolo_skillQ.mp3", gain: 4.2 },
  okuyasuBarrage: { file: "The hand/The_hand_barrage.mp3", gain: 1.35 },
  okuyasuBarrage7Page: { file: "The hand/7-page-erase-okuyasu.mp3", gain: 1.35 },
  okuyasuSkillE: { file: "The hand/thehand.mp3", gain: 1.4 },
  okuyasuNoise: { file: "The hand/the-hand-noise.mp3", gain: 1.35 },
  okuyasuVoice: { file: "The hand/okoyasu voice.mp3", gain: 1.0 },
  josukeBarrage: { file: "Josuke/dorarararara.mp3", gain: 1.35 },
  josukeSkillR: { file: "Josuke/crazy-diamond-skillR.mp3", gain: 1.4 },
  josukeSkillQ: { file: "Josuke/crazy-diamond-skillQ.mp3", gain: 1.6 },
  josukeVoice: { file: "Josuke/josukes-great.mp3", gain: 1.0 },
  polnareffBarrage: { file: "Polnareff/Sword_barrage.mp3", gain: 1.35 },
  polnareffSkillR: { file: "Polnareff/Sword_fly.mp3", gain: 1.35 },
  polnareffSkillQ: { file: "Polnareff/silver_chariot.mp3", gain: 1.55 },
  jolyneBarrage: { file: "Jolyne/stone-free-short-ora-barrage_6FevhFF.mp3", gain: 2.7 },
  jolyneSkillR: { file: "Jolyne/stone free.mp3", gain: 2.7 },
  jolyneSkillQHit: { file: "Jolyne/jolyne-sfx.mp3", gain: 1.55 },
  jolyneVoice: { file: "Jolyne/tmpnueglj1t.mp3", gain: 1.0 },
  lobbyBgm: { file: "Main game sound.mp3", gain: 1.7, isBgm: true },
  battleBgm: { file: "Sound Battle.mp3", gain: 1.0, isBgm: true },
  victory1: { file: "Victory.mp3", gain: 1.0, isBgm: true },
  victory2: { file: "Victory2.mp3", gain: 1.0, isBgm: true },
};

let audioCtx = null;
let isMuted = false;
let isSfxMuted = false;
let isBgmMuted = false;
let sfxVolume = 0.3;
let bgmVolume = 0.2;
const audioBuffers = new Map();
const activeVoices = new Set();
let diavoloImpactNoiseBuffer = null;
let activeBgm = null;
let _okuyasuBarrageSoundIndex = 0;

function ensureAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

const CHAR_SOUND_KEYS = {
  jotaro: ["jotaroBarrage", "jotaroStarFinger", "jotaroZaWarudo"],
  dio: ["dioBarrage", "dioRoadRoller", "dioTimeStop", "dioLaugh", "dioGreatestHigh"],
  kira: ["kiraBarrage", "kiraDetonate", "kiraSwitch", "kiraBiteTheDust", "kiraExploded"],
  diavolo: ["diavoloBarrage", "diavoloTimeSkip", "diavoloEpitaph"],
  okuyasu: ["okuyasuBarrage", "okuyasuBarrage7Page", "okuyasuSkillE", "okuyasuNoise", "okuyasuVoice"],
  josuke: ["josukeBarrage", "josukeSkillR", "josukeSkillQ", "josukeVoice"],
  polnareff: ["polnareffBarrage", "polnareffSkillR", "polnareffSkillQ"],
  jolyne: ["jolyneBarrage", "jolyneSkillR", "jolyneSkillQHit", "jolyneVoice"],
};

async function preloadMatchSounds(charIds = []) {
  ensureAudioContext();
  if (!audioCtx) return;
  const keys = new Set();
  for (const c of charIds) {
    for (const k of CHAR_SOUND_KEYS[c] || []) keys.add(k);
  }
  await Promise.all(
    [...keys].map(async (key) => {
      if (audioBuffers.has(key)) return;
      const spec = SOUNDS[key];
      if (!spec || spec.isBgm) return;
      try {
        const res = await fetch(encodePath(spec.file));
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(buf);
        audioBuffers.set(key, decoded);
      } catch {
        // Fallback to HTMLAudioElement
      }
    })
  );
}

function playSound(key, gainMult = 1.0) {
  if (!key || isMuted || isSfxMuted) return null;
  const spec = SOUNDS[key];
  if (!spec || spec.isBgm) return null;

  ensureAudioContext();
  const effectiveGain = spec.gain * sfxVolume * gainMult;
  if (effectiveGain <= 0.001) return null;

  const buffer = audioBuffers.get(key);
  if (audioCtx && buffer) {
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = effectiveGain;
    src.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const entry = { type: "buffer", src, gainNode, duration: buffer.duration, stopped: false };
    activeVoices.add(entry);
    src.onended = () => {
      entry.stopped = true;
      activeVoices.delete(entry);
    };
    src.start(0);
    return entry;
  }

  const audio = new Audio(encodePath(spec.file));
  audio.volume = Math.min(1, Math.max(0, key === "kiraBiteTheDust" ? sfxVolume : effectiveGain));
  const entry = { type: "html", audio, duration: 2.2, stopped: false };
  activeVoices.add(entry);
  audio.addEventListener("ended", () => {
    entry.stopped = true;
    activeVoices.delete(entry);
  });
  audio.play().catch(() => {});
  return entry;
}

function playBarragePunchImpact(intensity = 1) {
  if (isMuted || isSfxMuted || sfxVolume <= 0.001) return;
  ensureAudioContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const impactGain = audioCtx.createGain();
  impactGain.gain.setValueAtTime(Math.min(1, sfxVolume * 2.35 * intensity), now);
  impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  impactGain.connect(audioCtx.destination);

  const bass = audioCtx.createOscillator();
  const bassFilter = audioCtx.createBiquadFilter();
  const bassGain = audioCtx.createGain();
  bass.type = "triangle";
  bass.frequency.setValueAtTime(112, now);
  bass.frequency.exponentialRampToValueAtTime(38, now + 0.14);
  bassFilter.type = "lowpass";
  bassFilter.frequency.setValueAtTime(240, now);
  bassFilter.frequency.exponentialRampToValueAtTime(85, now + 0.14);
  bassGain.gain.setValueAtTime(0.85, now);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  bass.connect(bassFilter);
  bassFilter.connect(bassGain);
  bassGain.connect(impactGain);
  bass.start(now);
  bass.stop(now + 0.15);

  const growl = audioCtx.createOscillator();
  const growlFilter = audioCtx.createBiquadFilter();
  const growlGain = audioCtx.createGain();
  growl.type = "sawtooth";
  growl.frequency.setValueAtTime(185, now);
  growl.frequency.exponentialRampToValueAtTime(52, now + 0.13);
  growlFilter.type = "lowpass";
  growlFilter.frequency.setValueAtTime(920, now);
  growlFilter.frequency.exponentialRampToValueAtTime(180, now + 0.15);
  growlGain.gain.setValueAtTime(0.24, now);
  growlGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  growl.connect(growlFilter);
  growlFilter.connect(growlGain);
  growlGain.connect(impactGain);
  growl.start(now);
  growl.stop(now + 0.16);

  if (!diavoloImpactNoiseBuffer) {
    const sampleCount = Math.floor(audioCtx.sampleRate * 0.16);
    diavoloImpactNoiseBuffer = audioCtx.createBuffer(1, sampleCount, audioCtx.sampleRate);
    const samples = diavoloImpactNoiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.random() * 2 - 1;
    }
  }

  const noise = audioCtx.createBufferSource();
  const noiseFilter = audioCtx.createBiquadFilter();
  const noiseGain = audioCtx.createGain();
  noise.buffer = diavoloImpactNoiseBuffer;
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(1500, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(260, now + 0.14);
  noiseFilter.Q.value = 0.8;
  noiseGain.gain.setValueAtTime(0.42, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(impactGain);
  noise.start(now);
  noise.stop(now + 0.16);
}

function playDiavoloTimeSkipImpact() {
  if (isMuted || isSfxMuted || sfxVolume <= 0.001) return;
  ensureAudioContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.gain.setValueAtTime(Math.min(1, sfxVolume * 2.7), now);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  master.connect(audioCtx.destination);

  const thump = audioCtx.createOscillator();
  const thumpFilter = audioCtx.createBiquadFilter();
  const thumpGain = audioCtx.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(104, now);
  thump.frequency.exponentialRampToValueAtTime(34, now + 0.15);
  thumpFilter.type = "lowpass";
  thumpFilter.frequency.setValueAtTime(300, now);
  thumpFilter.frequency.exponentialRampToValueAtTime(90, now + 0.16);
  thumpGain.gain.setValueAtTime(0.95, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
  thump.connect(thumpFilter);
  thumpFilter.connect(thumpGain);
  thumpGain.connect(master);
  thump.start(now);
  thump.stop(now + 0.18);

  if (!diavoloImpactNoiseBuffer) {
    const sampleCount = Math.floor(audioCtx.sampleRate * 0.16);
    diavoloImpactNoiseBuffer = audioCtx.createBuffer(1, sampleCount, audioCtx.sampleRate);
    const samples = diavoloImpactNoiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.random() * 2 - 1;
    }
  }

  const crack = audioCtx.createBufferSource();
  const crackFilter = audioCtx.createBiquadFilter();
  const crackGain = audioCtx.createGain();
  crack.buffer = diavoloImpactNoiseBuffer;
  crackFilter.type = "lowpass";
  crackFilter.frequency.setValueAtTime(1600, now);
  crackFilter.frequency.exponentialRampToValueAtTime(240, now + 0.09);
  crackGain.gain.setValueAtTime(0.75, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  crack.connect(crackFilter);
  crackFilter.connect(crackGain);
  crackGain.connect(master);
  crack.start(now);
  crack.stop(now + 0.11);
}

let _lobbyBgmEl = null;
let _battleBgmEl = null;
let _victoryBgmEl = null;
let _desiredBgmMode = "lobby"; // "lobby" | "battle" | "victory" | "none"

function getOrCreateBgmEl(kind) {
  if (kind === "lobby") {
    if (!_lobbyBgmEl) {
      _lobbyBgmEl = new Audio(encodePath(SOUNDS.lobbyBgm.file));
      _lobbyBgmEl.loop = true;
      _lobbyBgmEl.preload = "auto";
    }
    return _lobbyBgmEl;
  }
  if (kind === "battle") {
    if (!_battleBgmEl) {
      _battleBgmEl = new Audio(encodePath(SOUNDS.battleBgm.file));
      _battleBgmEl.loop = true;
      _battleBgmEl.preload = "auto";
      _battleBgmEl.addEventListener("ended", () => {
        if (_desiredBgmMode === "battle" && !isMuted && !isBgmMuted && bgmVolume > 0.001) {
          _battleBgmEl.currentTime = 0;
          _battleBgmEl.play().catch(() => {});
        }
      });
    }
    return _battleBgmEl;
  }
  return null;
}

function stopAllBgmEls() {
  for (const el of [_lobbyBgmEl, _battleBgmEl, _victoryBgmEl]) {
    if (!el) continue;
    try {
      el.pause();
      el.currentTime = 0;
    } catch {}
  }
  activeBgm = null;
}

function startLobbyBgm() {
  _desiredBgmMode = "lobby";
  if (isMuted || isBgmMuted || bgmVolume <= 0.001) {
    stopAllBgmEls();
    return;
  }
  for (const el of [_battleBgmEl, _victoryBgmEl]) {
    if (el) { el.pause(); el.currentTime = 0; }
  }
  ensureAudioContext();
  const el = getOrCreateBgmEl("lobby");
  el.volume = Math.min(1, bgmVolume * SOUNDS.lobbyBgm.gain);
  if (el.paused) {
    el.play().catch(() => {});
  }
  activeBgm = { type: "html", mode: "lobby", audio: el };
}

function startBattleBgm() {
  _desiredBgmMode = "battle";
  if (isMuted || isBgmMuted || bgmVolume <= 0.001) {
    stopAllBgmEls();
    return;
  }
  for (const el of [_lobbyBgmEl, _victoryBgmEl]) {
    if (el) { el.pause(); el.currentTime = 0; }
  }
  ensureAudioContext();
  const el = getOrCreateBgmEl("battle");
  el.volume = Math.min(1, bgmVolume);
  el.currentTime = 0;
  el.play().catch(() => {});
  activeBgm = { type: "html", mode: "battle", audio: el };
}

function playVictoryBgm() {
  _desiredBgmMode = "victory";
  stopAllBgmEls();
  if (isMuted || isBgmMuted || bgmVolume <= 0.001) return;
  ensureAudioContext();
  const pick = Math.random() < 0.5 ? SOUNDS.victory1.file : SOUNDS.victory2.file;
  _victoryBgmEl = new Audio(encodePath(pick));
  _victoryBgmEl.loop = false;
  _victoryBgmEl.volume = Math.min(1, Math.max(0.25, bgmVolume * 1.4));
  _victoryBgmEl.play().catch(() => {});
  activeBgm = { type: "html", mode: "victory", audio: _victoryBgmEl };
}

function ensureDesiredBgmPlaying() {
  if (isMuted || isBgmMuted || bgmVolume <= 0.001) return;
  if (_desiredBgmMode === "battle" && state && state.running) {
    const el = getOrCreateBgmEl("battle");
    el.volume = Math.min(1, bgmVolume);
    if (el.paused) el.play().catch(() => {});
    activeBgm = { type: "html", mode: "battle", audio: el };
  } else if (_desiredBgmMode === "lobby" && (!state || !state.running)) {
    const el = getOrCreateBgmEl("lobby");
    el.volume = Math.min(1, bgmVolume * SOUNDS.lobbyBgm.gain);
    if (el.paused) el.play().catch(() => {});
    activeBgm = { type: "html", mode: "lobby", audio: el };
  }
}

function updateBgmVolumeLive() {
  const isSilent = isMuted || isBgmMuted || bgmVolume <= 0.001;
  if (isSilent) {
    stopAllBgmEls();
    return;
  }
  if (!activeBgm) {
    ensureDesiredBgmPlaying();
    return;
  }
  const effectiveVol = Math.min(
    1,
    bgmVolume * (activeBgm.mode === "lobby" ? SOUNDS.lobbyBgm.gain : 1)
  );
  if (activeBgm.type === "buffer" && audioCtx) {
    activeBgm.gainNode.gain.setValueAtTime(effectiveVol, audioCtx.currentTime);
  } else if (activeBgm.audio) {
    activeBgm.audio.volume = Math.min(1, effectiveVol);
    if (activeBgm.audio.paused && _desiredBgmMode !== "victory") {
      activeBgm.audio.play().catch(() => {});
    }
  }
}

function stopBattleBgm() {
  if (_battleBgmEl) {
    _battleBgmEl.pause();
    _battleBgmEl.currentTime = 0;
  }
  if (activeBgm && activeBgm.mode === "battle") {
    activeBgm = null;
  }
}

function fadeOutAndStopAudio(entry, durationMs = 160) {
  if (!entry || entry.stopped) return;
  entry.stopped = true;

  if (entry.type === "buffer" && audioCtx) {
    const now = audioCtx.currentTime;
    entry.gainNode.gain.setValueAtTime(entry.gainNode.gain.value, now);
    entry.gainNode.gain.linearRampToValueAtTime(0.001, now + durationMs / 1000);
    setTimeout(() => {
      try {
        entry.src.stop();
      } catch {}
      activeVoices.delete(entry);
    }, durationMs);
  } else if (entry.type === "html" && entry.audio) {
    entry.audio.pause();
    entry.audio.currentTime = 0;
    activeVoices.delete(entry);
  }
}

function stopAllSounds() {
  for (const entry of activeVoices) {
    entry.stopped = true;
    if (entry.type === "buffer") {
      try {
        entry.src.stop();
      } catch {}
    } else if (entry.audio) {
      entry.audio.pause();
      entry.audio.currentTime = 0;
    }
  }
  activeVoices.clear();
  stopAllBgmEls();
}

// ── DOM References ──────────────────────────────────────────
const p1AvatarBox = document.getElementById("p1-avatar-box");
const p1AvatarImg = document.getElementById("p1-avatar-img");
const p1NameEl = document.getElementById("p1-name");
const p1HpFill = document.getElementById("p1-hp-fill");
const p1HpTrail = document.getElementById("p1-hp-trail");
const p1HpText = document.getElementById("p1-hp-text");
const p1GuardFill = document.getElementById("p1-guard-fill");

const p2AvatarBox = document.getElementById("p2-avatar-box");
const p2AvatarImg = document.getElementById("p2-avatar-img");
const p2NameEl = document.getElementById("p2-name");
const p2HpFill = document.getElementById("p2-hp-fill");
const p2HpTrail = document.getElementById("p2-hp-trail");
const p2HpText = document.getElementById("p2-hp-text");
const p2GuardFill = document.getElementById("p2-guard-fill");

const timestopBanner = document.getElementById("timestop-banner");
const timestopLabel = document.getElementById("timestop-label");
const timestopTimer = document.getElementById("timestop-timer");

const vsIntroOverlay = document.getElementById("vs-intro-overlay");
const vsP1Name = document.getElementById("vs-p1-name");
const vsP2Name = document.getElementById("vs-p2-name");
const vsP1Img = document.getElementById("vs-p1-img");
const vsP2Img = document.getElementById("vs-p2-img");

const resultBanner = document.getElementById("result-banner");
const resultBannerText = document.getElementById("result-banner-text");
const resultBannerSub = document.getElementById("result-banner-sub");

const mainMenuOverlay = document.getElementById("main-menu-overlay");
const selectOverlay = document.getElementById("select-overlay");
const mainMenuVideo = document.getElementById("main-menu-video");
const characterPreviewVideo = document.getElementById("character-preview-video");
const characterPreviewImage = document.getElementById("character-preview-image");
const aiColHeader = document.getElementById("ai-col-header");
const aiDiffDesc = document.getElementById("ai-diff-desc");
const arenaMapLabel = document.getElementById("arena-map-label");
const endOverlay = document.getElementById("end-overlay");
const endTitle = document.getElementById("end-title");
const endSubtitle = document.getElementById("end-subtitle");
const settingsOverlay = document.getElementById("settings-overlay");
const graphicsModeLabel = document.getElementById("graphics-mode-label");

const sfxSlider = document.getElementById("sfx-volume");
const sfxValEl = document.getElementById("sfx-volume-val");
const bgmSlider = document.getElementById("bgm-volume");
const bgmValEl = document.getElementById("bgm-volume-val");
const toggleSfxBtn = document.getElementById("toggle-sfx-btn");
const toggleBgmBtn = document.getElementById("toggle-bgm-btn");

const muteBtn = document.getElementById("mute-btn");
const settingsBtn = document.getElementById("settings-btn");
const menuBtn = document.getElementById("menu-btn");

const skillBtns = {
  q: {
    btn: document.getElementById("btn-q"),
    name: document.getElementById("skill-name-q"),
    overlay: document.getElementById("cd-q"),
    text: document.getElementById("cd-text-q"),
  },
  e: {
    btn: document.getElementById("btn-e"),
    name: document.getElementById("skill-name-e"),
    overlay: document.getElementById("cd-e"),
    text: document.getElementById("cd-text-e"),
  },
  r: {
    btn: document.getElementById("btn-r"),
    name: document.getElementById("skill-name-r"),
    overlay: document.getElementById("cd-r"),
    text: document.getElementById("cd-text-r"),
  },
  t: {
    btn: document.getElementById("btn-t"),
    name: document.getElementById("skill-name-t"),
    overlay: document.getElementById("cd-t"),
    text: document.getElementById("cd-text-t"),
  },
  dash: {
    btn: document.getElementById("btn-dash"),
    overlay: document.getElementById("cd-dash"),
    text: document.getElementById("cd-text-dash"),
  },
};
const guardBtnEl = document.getElementById("btn-f");
const guardDescEl = document.getElementById("guard-desc-f");

// ── Character Configs ───────────────────────────────────────
const CHAR_CONFIG = Object.fromEntries(
  Object.entries(window.JOJO_CHARS || {}).map(([id, cfg]) => [
    id,
    {
      ...cfg,
      imgAsset: () => loadOrGetCharacterAsset(cfg.imgPath),
      armAsset: () => loadOrGetCharacterAsset(cfg.armPath),
    },
  ])
);
const CHARACTER_PREVIEW_VIDEOS = {
  jotaro: "Jotaro/jotaro.mp4",
  dio: "Dio/Dio.mp4",
  kira: "killerqueen/Kira.mp4",
  diavolo: "Diavolo/diavolo.mp4",
  okuyasu: "The hand/Okuyasu.mp4",
  josuke: "Josuke/Josuke.mp4",
  polnareff: "Polnareff/Polnareff.mp4",
  jolyne: "Jolyne/Jolyne.mp4",
};
const CHARACTER_PREVIEW_IMAGES = {
  jotaro: "Jotaro/Star platium.png",
  dio: "Dio/Dio.png",
  kira: "killerqueen/Kira.png",
  diavolo: "Diavolo/Diavolo.png",
  okuyasu: "The hand/Okuyasu.png",
  josuke: "Josuke/josuke.png",
  polnareff: "Polnareff/Polnareff.png",
  jolyne: "Jolyne/Jolyne.png",
};
const CHARACTER_PORTRAITS = CHARACTER_PREVIEW_IMAGES;
const CHARACTER_PORTRAIT_POSITIONS = {
  jotaro: "35% 36%",
  dio: "35% 38%",
  kira: "61% 40%",
  diavolo: "35% 38%",
  okuyasu: "55% 40%",
  josuke: "62% 40%",
  polnareff: "62% 38%",
  jolyne: "37% 38%",
};

const _charAssetCache = {};
function loadOrGetCharacterAsset(path) {
  if (!_charAssetCache[path]) {
    _charAssetCache[path] = loadImage(path);
  }
  return _charAssetCache[path];
}

let selectedPlayerChar = "jotaro";
let selectedAiChar = "dio";
let selectedAiDifficulty = "hard";
let activeSelectionSide = "p1";
let lastTime = 0;
let vsTimerHandle = null;
let endTimerHandle = null;
let characterPreviewSwitchTimer = null;
const keysPressed = new Set();
const touchInput = { x: 0, y: 0, guarding: false };
let touchMode = "auto"; // "auto" | "on" | "off"

function getActiveAiDiff() {
  const key = (state && state.aiDifficulty) || selectedAiDifficulty;
  return AI_DIFFICULTIES[key] || AI_DIFFICULTIES.hard;
}

function getDamageMultiplier(attackerSlot) {
  if (attackerSlot !== "p2") return 1.0;
  return getActiveAiDiff().dmgMult || 1.0;
}

function createFighter(slot, charId, x, y, vx, vy) {
  const cfg = CHAR_CONFIG[charId];
  const bonusHp = slot === "p2" ? (AI_DIFFICULTIES[selectedAiDifficulty]?.hpBonus || 0) : 0;
  const maxHp = MAX_HP + bonusHp;
  return {
    slot,
    charId,
    x,
    y,
    vx,
    vy,
    radius: 44,
    hp: maxHp,
    maxHp,
    img: cfg.imgAsset(),
    facing: slot === "p1" ? 1 : -1,
    hitFlash: 0,
    hidden: false,
    barrageQueue: null,
    isGuarding: false,
    guardPool: MAX_GUARD_POOL,
    guardBrokenTimer: 0,
    guardRegenDelay: 0,
    biteTheDustCharge: 0,
    biteTheDustChargeDuration: 0,
    dashTimer: 0,
    dashVx: 0,
    dashVy: 0,
    dashEchoTimer: 0,
    stunTimer: 0,
    barrageStunSlot: null,
    sealedTimer: 0,
    epitaphTimer: 0,
    armorOffTimer: 0,
    jolynePoseTimer: 0,
    lastAttackerSlot: null,
    voiceTimer: charId === "okuyasu" ? 25 : 18 + Math.random() * 7,
    knockbackTimer: 0,
    isChargingTimeStop: false,
    timeStopCharge: 0,
    timeStopChargeMax: 1.0,
    timeStopPendingDmg: 0,
    timeStopPendingColor: "#ff4d4f",
    timeStopPendingHeavy: false,
    timeStopPendingKnockback: null,
  };
}

function configureHudAndSkillBar(p1Char, p2Char) {
  const pCfg = CHAR_CONFIG[p1Char];
  const aCfg = CHAR_CONFIG[p2Char];
  const diffCfg = getActiveAiDiff();

  p1NameEl.innerHTML = `${pCfg.name} <small>(BẠN)</small>`;
  p1AvatarImg.src = encodePath(pCfg.imgPath);
  p1AvatarBox.className = `avatar-box ${pCfg.themeClass}`;
  p1HpFill.className = `hp-bar-fill ${pCfg.fillClass}`;

  p2NameEl.innerHTML = `${aCfg.name} <small>(${diffCfg.hudTag})</small>`;
  p2AvatarImg.src = encodePath(aCfg.imgPath);
  p2AvatarBox.className = `avatar-box ${aCfg.themeClass}`;
  p2HpFill.className = `hp-bar-fill ${aCfg.fillClass}`;

  for (const k of ["q", "e", "r"]) {
    if (k === "q") {
      skillBtns[k].name.textContent = "Ulti";
    } else {
      skillBtns[k].name.textContent = "";
    }
    skillBtns[k].btn.title = `${pCfg.skills[k].name} — ${pCfg.skills[k].desc}`;
    skillBtns[k].btn.classList.remove(
      "dio-mode",
      "kira-mode",
      "diavolo-mode",
      "okuyasu-mode",
      "josuke-mode",
      "polnareff-mode",
      "jolyne-mode"
    );
    if (pCfg.modeClass) skillBtns[k].btn.classList.add(pCfg.modeClass);
  }

  if (p1Char === "kira") {
    skillBtns.t.btn.classList.remove("hidden");
    skillBtns.t.btn.classList.add("kira-mode");
    document.getElementById("m-btn-t")?.classList.remove("hidden");
  } else {
    skillBtns.t.btn.classList.add("hidden");
    document.getElementById("m-btn-t")?.classList.add("hidden");
  }
}

function resolveAiCharacter() {
  if (selectedAiChar !== "random") return selectedAiChar;
  const pool = ["jotaro", "dio", "kira", "diavolo", "okuyasu", "josuke", "polnareff", "jolyne"];
  return pool[Math.floor(Math.random() * pool.length)];
}

function startMatchWithIntro() {
  syncArenaSize();
  selectRandomArenaMap();
  releaseSceneVideo(mainMenuVideo);
  releaseSceneVideo(characterPreviewVideo);
  stopAllSounds();
  _desiredBgmMode = "battle";
  if (vsTimerHandle) clearTimeout(vsTimerHandle);
  if (endTimerHandle) clearTimeout(endTimerHandle);

  const p1Char = selectedPlayerChar;
  const p2Char = resolveAiCharacter();
  preloadMatchSounds([p1Char, p2Char]);

  selectOverlay.classList.add("hidden");
  endOverlay.classList.add("hidden");
  mainMenuOverlay.classList.add("hidden");
  resultBanner.classList.add("hidden");

  const diffCfg = AI_DIFFICULTIES[selectedAiDifficulty] || AI_DIFFICULTIES.hard;
  vsP1Name.textContent = CHAR_CONFIG[p1Char].name;
  vsP2Name.textContent = `${CHAR_CONFIG[p2Char].name} (${diffCfg.label})`;
  vsP1Img.src = encodePath(CHARACTER_PORTRAITS[p1Char] || CHAR_CONFIG[p1Char].imgPath);
  vsP2Img.src = encodePath(CHARACTER_PORTRAITS[p2Char] || CHAR_CONFIG[p2Char].imgPath);
  vsP1Img.alt = `${CHAR_CONFIG[p1Char].name} portrait`;
  vsP2Img.alt = `${CHAR_CONFIG[p2Char].name} portrait`;
  vsP1Img.style.objectPosition = CHARACTER_PORTRAIT_POSITIONS[p1Char] || "center 38%";
  vsP2Img.style.objectPosition = CHARACTER_PORTRAIT_POSITIONS[p2Char] || "center 38%";
  vsIntroOverlay.classList.remove("hidden");

  initGameState(p1Char, p2Char);
  state.running = false;
  syncMobileControlsVisibility();

  vsTimerHandle = setTimeout(() => {
    vsIntroOverlay.classList.add("hidden");
    if (state && !state.gameOver) {
      state.running = true;
      syncMobileControlsVisibility();
      lastTime = performance.now();
      startBattleBgm();
    }
  }, 1900);
}

function initGameState(p1Char, p2Char) {
  configureHudAndSkillBar(p1Char, p2Char);

  const a1 = Math.random() * Math.PI * 2;
  const a2 = Math.random() * Math.PI * 2;
  const baseSpeed = 180;

  const spawnOffset = Math.min(340, ARENA_W * 0.25);
  const p1 = createFighter(
    "p1",
    p1Char,
    ARENA_CX - spawnOffset,
    ARENA_CY,
    Math.cos(a1) * baseSpeed,
    Math.sin(a1) * baseSpeed
  );

  const p2 = createFighter(
    "p2",
    p2Char,
    ARENA_CX + spawnOffset,
    ARENA_CY,
    Math.cos(a2) * baseSpeed,
    Math.sin(a2) * baseSpeed
  );

  state = {
    running: false,
    gameOver: false,
    aiDifficulty: selectedAiDifficulty,
    p1,
    p2,
    cooldowns: {
      p1: { q: 0, e: 0, r: 0, dash: 0, dashMax: DASH_COOLDOWN },
      p2: { q: 0, e: 0, r: 0, dash: 0, dashMax: DASH_COOLDOWN },
    },
    collisionDamageCooldown: 0,
    timeStop: {
      active: false,
      casterSlot: null,
      remaining: 0,
      duration: 0,
      rippleRadius: 0,
    },
    roadRoller: {
      active: false,
      casterSlot: null,
      phase: "none",
      timer: 0,
      targetX: ARENA_CX,
      targetY: ARENA_CY,
      dropY: -260,
      impactRadius: 150,
      safetyTimer: 0,
    },
    firstBombs: [],
    epitaphCounter: null,
    epitaphFists: [],
    mobiusCounter: null,
    mobiusFists: [],
    pendingOhkos: [], // { targetSlot, timer } — waits for explosion VFX before finishing target
    explosions: [],
    barrageClashes: [],
    starFingerBeams: [],
    eraseSwipes: [],
    theHandQueue: [],
    groundCracks: [],
    josukeRocks: [],
    angeloPunches: [],
    swordProjectiles: [],
    polnareffClones: [],
    dashAfterimages: [],
    stringFingers: [],
    mobiusWebs: [],
    diavoloTimeSkipZones: [],
    diavoloImpales: [],
    punches: [],
    particles: [],
    floatingTexts: [],
    screenShake: 0,
    uiSyncTimer: 0,
    dioTauntTimer: 10 + Math.random() * 5,
    aiDecisionTimer: 0.45,
    aiTargetSlot: "p1",
    aiTargetTimer: 0,
    aiTargetRoster: "p1",
    polnareffCloneSerial: 0,
    aiReflexTimer: 0,
    aiGuardTimer: 0,
    aiStrafeDir: 1,
    aiStrafeSwitchTimer: 1.2,
    aiCombo: null,
  };

  const diffCfg = getActiveAiDiff();
  state.cooldowns.p2.q = diffCfg.startDelayQ;
  state.cooldowns.p2.e = diffCfg.startDelayE;
  state.cooldowns.p2.r = p2Char === "dio" ? Math.max(diffCfg.startDelayR, diffCfg.id === "super" ? 4.5 : 8.5) : diffCfg.startDelayR;

  resetUiCache();
  updateHpUI();
  updateSkillBarUI();
  timestopBanner.classList.add("hidden");
}

// ── Helpers ─────────────────────────────────────────────────
function getFighter(slot) {
  if (!state) return null;
  if (slot === "p1") return state.p1;
  if (slot === "p2") return state.p2;
  return state.polnareffClones.find((clone) => clone.slot === slot) || null;
}

function getOpponent(slot) {
  if (slot === "p1") return state.p2;
  if (slot === "p2") {
    const target = getFighter(state.aiTargetSlot);
    return target && !target.hidden && target.hp > 0 ? target : state.p1;
  }
  const fighter = getFighter(slot);
  const ownerSlot = fighter?.ownerSlot ||
    (typeof slot === "string" && slot.startsWith("polnareff-clone-p1-")
      ? "p1"
      : typeof slot === "string" && slot.startsWith("polnareff-clone-p2-")
        ? "p2"
        : null);
  return ownerSlot === "p1" ? state.p2 : state.p1;
}

function chooseAiTarget(dt) {
  const candidates = [
    state.p1,
    ...state.polnareffClones.filter((clone) => clone.ownerSlot === "p1" && !clone.hidden && clone.hp > 0),
  ];
  const roster = candidates.map((target) => target.slot).join("|");
  const currentTarget = candidates.find((target) => target.slot === state.aiTargetSlot);
  state.aiTargetTimer -= dt;

  if (state.aiCombo && currentTarget) return currentTarget;
  if (roster !== state.aiTargetRoster || !currentTarget || state.aiTargetTimer <= 0) {
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    state.aiTargetSlot = target.slot;
    state.aiTargetRoster = roster;
    state.aiTargetTimer = 0.35 + Math.random() * 0.55;
    return target;
  }
  return currentTarget;
}

function getActiveBarrageStunner(fighter) {
  if (!fighter.barrageStunSlot) return null;
  const source = getFighter(fighter.barrageStunSlot);
  if (!source || !source.barrageQueue || fighter.barrageQueue) {
    fighter.barrageStunSlot = null;
    return null;
  }
  return source;
}

function isFrozen(slot) {
  return state.timeStop.active && state.timeStop.casterSlot !== slot;
}

function spawnParticles(x, y, color, count = 12, speed = 180) {
  const maxParticles = isTouchDeviceOrSmallScreen() ? 64 : 110;
  if (state.particles.length >= maxParticles) return;
  const allowed = Math.min(count, maxParticles - state.particles.length);
  for (let i = 0; i < allowed; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      radius: 3 + Math.random() * 4,
      color,
      life: 0.35 + Math.random() * 0.25,
      maxLife: 0.6,
    });
  }
}

function spawnBombExplosion(x, y, radius, theme = "orange", shakeAmount = 10) {
  // Multi-layered realistic anime bomb explosion
  const puffs = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const dist = radius * (0.2 + Math.random() * 0.55);
    puffs.push({
      angle,
      dist,
      size: radius * (0.28 + Math.random() * 0.22),
      delay: Math.random() * 0.12,
    });
  }

  state.explosions.push({
    x,
    y,
    radius,
    theme,
    life: 0.82,
    maxLife: 0.82,
    puffs,
  });

  // Debris, embers & smoke particles
  const emberColor = theme === "pink" ? "#f472b6" : "#fb923c";
  spawnParticles(x, y, "#fef08a", 22, 420);
  spawnParticles(x, y, emberColor, 26, 360);
  spawnParticles(x, y, "#475569", 14, 180);

  state.screenShake = Math.max(state.screenShake, shakeAmount);
}

function spawnFloatingText(x, y, text, color = "#fde047", size = 22) {
  state.floatingTexts.push({
    x,
    y,
    vy: -55,
    text,
    color,
    size,
    life: 0.95,
    maxLife: 0.95,
  });
}

function applyAttackDamage(attackerSlot, target, baseAmount, color = "#ff4d4f", isHeavy = false) {
  target.lastAttackerSlot = attackerSlot;
  const scaled = Math.round(baseAmount * getDamageMultiplier(attackerSlot) * 10) / 10;
  applyDamage(target, scaled, color, isHeavy);
}

function applyDamage(target, amount, color = "#ff4d4f", isHeavy = false) {
  if (state.gameOver || target.hidden) return;

  let finalDmg = amount;
  if (target.isGuarding && target.guardPool > 0) {
    if (isHeavy) {
      target.guardPool = 0;
      target.isGuarding = false;
      target.guardBrokenTimer = GUARD_LOCK_SECONDS;
      spawnFloatingText(target.x, target.y - target.radius - 36, `PHÁ GIÁP! (${GUARD_LOCK_SECONDS}s)`, "#ef4444", 22);
      spawnParticles(target.x, target.y, "#38bdf8", 16, 220);
    } else {
      const absorbed = Math.min(amount, target.guardPool);
      target.guardPool = Math.max(0, Math.round((target.guardPool - absorbed) * 10) / 10);
      finalDmg = Math.max(0, Math.round((amount - absorbed) * 10) / 10);

      if (target.guardPool <= 0) {
        target.isGuarding = false;
        target.guardBrokenTimer = GUARD_LOCK_SECONDS;
        spawnFloatingText(target.x, target.y - target.radius - 36, `VỠ KHIÊN! (${GUARD_LOCK_SECONDS}s)`, "#38bdf8", 20);
      } else {
        spawnFloatingText(target.x, target.y - target.radius - 30, "ĐỠ!", "#38bdf8", 16);
      }

      if (finalDmg <= 0) {
        updateHpUI();
        return;
      }
    }
  }

  // Taking real damage interrupts Time Stop charge!
  if (finalDmg > 0 && target.isChargingTimeStop) {
    cancelTimeStopCharge(target, "BỊ NGẮT CHIÊU!", 2.5);
  }

  // Diavolo Epitaph counter: triggers when Diavolo takes damage during 3s window!
  if (finalDmg > 0 && target.epitaphTimer > 0 && !target.hidden && target.charId === "diavolo") {
    triggerEpitaphCounter(target);
  }

  // During Time Stop, freeze HP bars and store all accumulated damage until time resumes
  if (state.timeStop.active) {
    target.timeStopPendingDmg += finalDmg;
    target.timeStopPendingColor = color;
    if (isHeavy) target.timeStopPendingHeavy = true;
    target.hitFlash = Math.max(target.hitFlash, 0.08);
    updateHpUI();
    return;
  }

  target.hp = Math.max(0, Math.round((target.hp - finalDmg) * 10) / 10);
  target.hitFlash = 0.14;

  const pctLoss = ((finalDmg / target.maxHp) * 100).toFixed(1);
  const dmgLabel = finalDmg >= target.maxHp ? "OHKO!" : `-${pctLoss}%`;
  spawnFloatingText(
    target.x + (Math.random() - 0.5) * 38,
    target.y - target.radius - 12,
    dmgLabel,
    color,
    finalDmg >= 25 ? 26 : 17
  );
  updateHpUI();

  if (target.isPolnareffClone) {
    if (target.hp <= 0) {
      target.hidden = true;
      target.life = 0;
      target.barrageQueue = null;
      spawnFloatingText(target.x, target.y - target.radius - 24, "PHÂN THÂN BỊ HẠ!", "#e2e8f0", 18);
      if (state.aiTargetSlot === target.slot) state.aiTargetTimer = 0;
    }
    return;
  }

  if (target.hp <= 0) {
    endGame(target.slot === "p2" ? "p1" : "p2");
  }
}

function endGame(winnerSlot) {
  state.gameOver = true;
  state.running = false;
  syncMobileControlsVisibility();
  state.epitaphCounter = null;
  state.epitaphFists.length = 0;
  state.mobiusCounter = null;
  state.mobiusFists.length = 0;
  state.timeStop.active = false;
  state.p1.timeStopPendingDmg = 0;
  state.p2.timeStopPendingDmg = 0;
  timestopBanner.classList.add("hidden");
  stopBattleBgm();

  const playerWon = winnerSlot === "p1";
  if (playerWon) {
    playVictoryBgm();
  } else {
    _desiredBgmMode = "none";
  }
  const winnerName = CHAR_CONFIG[getFighter(winnerSlot).charId].name;

  resultBanner.className = playerWon ? "victory" : "defeat";
  resultBannerText.textContent = playerWon ? "VICTORY!" : "DEFEAT!";
  resultBannerSub.textContent = playerWon
    ? `${winnerName} CHIẾN THẮNG!`
    : `${winnerName} ĐÃ HẠ GỤC BẠN`;
  resultBanner.classList.remove("hidden");

  endTimerHandle = setTimeout(() => {
    resultBanner.classList.add("hidden");
    endTitle.textContent = playerWon ? `CHIẾN THẮNG! (${winnerName})` : `THẤT BẠI! (${winnerName})`;
    endSubtitle.textContent = playerWon
      ? "Tuyệt vời! Bạn đã hạ gục đối thủ trong đấu trường JoJo."
      : "Bạn đã bị hạ gục! Hãy chọn chơi lại hoặc quay về Menu chính.";
    endOverlay.classList.remove("hidden");
  }, 2000);
}

// ── Dash (Shift, CD 4s) ─────────────────────────────────────
function spawnDashAfterimage(fighter) {
  const image =
    fighter.charId === "polnareff" && fighter.armorOffTimer > 0
      ? ASSETS.polnareffArmorOff
      : fighter.img;
  state.dashAfterimages.push({
    x: fighter.x,
    y: fighter.y,
    img: image,
    charId: fighter.charId,
    facing: fighter.facing,
    radius: fighter.radius,
    life: 0.24,
    maxLife: 0.24,
  });
}

function triggerDash(fighter, dirX = null, dirY = null) {
  if (!state || !state.running) return;
  if (fighter.hidden || isFrozen(fighter.slot) || fighter.biteTheDustCharge > 0 || fighter.stunTimer > 0 || fighter.sealedTimer > 0 || fighter.isChargingTimeStop) return;
  if (state.cooldowns[fighter.slot].dash > 0) return;

  let dx = dirX;
  let dy = dirY;

  if (dx === null || dy === null) {
    dx = 0;
    dy = 0;
    if (fighter.slot === "p1") {
      if (keysPressed.has("w")) dy -= 1;
      if (keysPressed.has("s")) dy += 1;
      if (keysPressed.has("a")) dx -= 1;
      if (keysPressed.has("d")) dx += 1;
      if (dx === 0 && dy === 0 && (Math.abs(touchInput.x) > 0.15 || Math.abs(touchInput.y) > 0.15)) {
        dx = touchInput.x;
        dy = touchInput.y;
      }
    }
    if (dx === 0 && dy === 0) {
      dx = fighter.facing || 1;
      dy = 0;
    }
  }

  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  const dashCd =
    fighter.charId === "polnareff" && fighter.armorOffTimer > 0
      ? CHAR_CONFIG.polnareff.skills.q.dashCd || 2.0
      : DASH_COOLDOWN;
  state.cooldowns[fighter.slot].dash = dashCd;
  state.cooldowns[fighter.slot].dashMax = dashCd;
  fighter.dashTimer = 0.18;
  fighter.dashVx = dx * 760;
  fighter.dashVy = dy * 760;
  fighter.vx = dx * 230;
  fighter.vy = dy * 230;
  fighter.dashEchoTimer = 0.035;
  spawnDashAfterimage(fighter);

  spawnParticles(fighter.x, fighter.y, CHAR_CONFIG[fighter.charId].color, 14, 240);
  spawnFloatingText(fighter.x, fighter.y - fighter.radius - 10, "DASH!", "#4ade80", 16);
}

function startTimeStopCharge(casterSlot) {
  const caster = getFighter(casterSlot);
  if (
    !state ||
    !state.running ||
    caster.hidden ||
    isFrozen(casterSlot) ||
    caster.biteTheDustCharge > 0 ||
    caster.stunTimer > 0 ||
    caster.isChargingTimeStop ||
    state.timeStop.active ||
    state.cooldowns[casterSlot].q > 0
  ) {
    return;
  }
  const qCfg = CHAR_CONFIG[caster.charId]?.skills?.q;
  if (caster.charId === "kira" || !qCfg || !qCfg.chargeTime) return;

  caster.isChargingTimeStop = true;
  caster.timeStopCharge = 0;
  caster.timeStopChargeMax = qCfg.chargeTime;
  caster.isGuarding = false;
  caster.vx *= 0.3;
  caster.vy *= 0.3;
  spawnFloatingText(caster.x, caster.y - caster.radius - 26, "ĐANG TỤ ZA WARUDO...", CHAR_CONFIG[caster.charId].color, 18);
}

function cancelTimeStopCharge(fighter, reasonText = "HỦY CHIÊU!", penaltyCd = 0) {
  if (!fighter || !fighter.isChargingTimeStop) return;
  fighter.isChargingTimeStop = false;
  fighter.timeStopCharge = 0;
  if (penaltyCd > 0 && state?.cooldowns?.[fighter.slot]) {
    state.cooldowns[fighter.slot].q = Math.max(state.cooldowns[fighter.slot].q, penaltyCd);
  }
  const isInterrupt = reasonText.includes("NGẮT");
  spawnFloatingText(fighter.x, fighter.y - fighter.radius - 28, reasonText, isInterrupt ? "#ef4444" : "#94a3b8", 19);
  if (isInterrupt) {
    spawnParticles(fighter.x, fighter.y, "#ef4444", 12, 200);
  }
}

// ── Skills ──────────────────────────────────────────────────
function castSkill(casterSlot, key) {
  if (!state || !state.running) return;
  const caster = getFighter(casterSlot);
  const opponent = getOpponent(casterSlot);
  const barrageStunner = getActiveBarrageStunner(caster);
  if (
    caster.hidden ||
    isFrozen(casterSlot) ||
    caster.biteTheDustCharge > 0 ||
    (caster.stunTimer > 0 && !barrageStunner) ||
    caster.sealedTimer > 0 ||
    caster.isChargingTimeStop ||
    caster.barrageQueue?.rooted ||
    state.epitaphCounter?.casterSlot === casterSlot ||
    state.mobiusCounter?.casterSlot === casterSlot
  ) {
    return;
  }

  if (key === "t") {
    if (caster.charId !== "kira" || barrageStunner) return;
    detonateFirstBomb(casterSlot);
    return;
  }

  if (state.cooldowns[casterSlot][key] > 0) return;
  const charModule = CHAR_CONFIG[caster.charId];
  if (!charModule || !charModule.skills[key]) return;
  const skillCfg = charModule.skills[key];
  if (barrageStunner && !skillCfg.isBarrage) return;
  if (key === "q" && caster.charId !== "kira" && charModule.skills.q?.chargeTime > 0) {
    startTimeStopCharge(casterSlot);
    return;
  }

  if (skillCfg.isBarrage) {
    if (caster.barrageQueue) return; // Already holding barrage
    state.cooldowns[casterSlot][key] = skillCfg.cd;
  } else {
    state.cooldowns[casterSlot][key] = skillCfg.cd;
  }

  if (barrageStunner) {
    caster.barrageStunSlot = null;
    caster.stunTimer = 0;
    caster.knockbackTimer = 0;
    caster.vx = 0;
    caster.vy = 0;
  }

  charModule.castSkill(
    {
      state,
      playSound,
      fadeOutAndStopAudio,
      activateTimeStop,
      startBarrage,
      plantFirstBomb,
      spawnFloatingText,
      triggerTimeSkip,
      activateEpitaph,
      castTheHandPull,
      castTheHandSpaceErase,
      castJosukeRock,
      castJosukeAngelo,
      castPolnareffSword,
      activatePolnareffArmorOff,
      triggerCloneSkill,
      castJolyneStringFinger,
      castJolyneMobiusWeb,
    },
    casterSlot,
    caster,
    opponent,
    key
  );
}

function plantFirstBomb(caster, opponent, rCfg = CHAR_CONFIG.kira.skills.r) {
  state.firstBombs = state.firstBombs.filter((b) => b.ownerSlot !== caster.slot);
  playSound(rCfg.soundKey || "kiraDetonate");

  const dist = Math.hypot(opponent.x - caster.x, opponent.y - caster.y);
  // Only player uses instant touch-OHKO; Kira AI fights tactically via smart ground trap bombs (no instant 1-touch cheese)
  const touching =
    caster.slot === "p1" && !opponent.hidden && dist <= caster.radius + opponent.radius + 10;
  const duration = rCfg.bombDuration || 8;

  if (touching) {
    state.firstBombs.push({
      ownerSlot: caster.slot,
      x: opponent.x,
      y: opponent.y,
      life: duration,
      maxLife: duration,
      attachedSlot: opponent.slot,
    });
    spawnFloatingText(opponent.x, opponent.y - 90, "ĐÃ GẮN BOM! (BẤM T)", "#ef4444", 22);
    spawnParticles(opponent.x, opponent.y, "#ef4444", 16, 200);
  } else {
    let bx;
    let by;
    if (caster.slot === "p2") {
      // Smart Kira AI places floor bomb trap right in front of Kira along player's path (cannot teleport on top of player)
      const predX = opponent.x + opponent.vx * 0.2;
      const predY = opponent.y + opponent.vy * 0.2;
      const dx = predX - caster.x;
      const dy = predY - caster.y;
      const d = Math.hypot(dx, dy) || 1;
      const placeDist = Math.min(d * 0.42, caster.radius + 44);
      bx = Math.max(ARENA_LEFT + 36, Math.min(ARENA_RIGHT - 36, caster.x + (dx / d) * placeDist));
      by = Math.max(ARENA_TOP + 36, Math.min(ARENA_BOTTOM - 36, caster.y + (dy / d) * placeDist));
    } else {
      bx = Math.max(
        ARENA_LEFT + 36,
        Math.min(ARENA_RIGHT - 36, caster.x + caster.facing * (caster.radius + 36))
      );
      by = Math.max(ARENA_TOP + 36, Math.min(ARENA_BOTTOM - 36, caster.y));
    }
    state.firstBombs.push({
      ownerSlot: caster.slot,
      x: bx,
      y: by,
      life: duration,
      maxLife: duration,
      armTimer: caster.slot === "p2" ? 1.0 : 0, // Kira AI must wait at least 1s after planting before detonating
      attachedSlot: null,
    });
    spawnFloatingText(bx, by - 40, caster.slot === "p2" ? "ĐẶT BẪY BOM! (1s)" : "FIRST BOMB! (T KÍCH NỔ)", "#f472b6", 20);
    spawnParticles(bx, by, "#f472b6", 10, 150);
  }
}

function detonateFirstBomb(casterSlot) {
  const idx = state.firstBombs.findIndex((b) => b.ownerSlot === casterSlot);
  if (idx === -1) return;

  const bomb = state.firstBombs[idx];
  if (bomb.armTimer > 0) return; // Enforce 1s fuse delay before AI can detonate

  state.firstBombs.splice(idx, 1);
  playSound("kiraSwitch");
  playSound("kiraExploded");

  const rCfg = CHAR_CONFIG.kira.skills.r;
  const opponent = getOpponent(casterSlot);
  if (bomb.attachedSlot === opponent.slot) {
    // Explosion VFX blooms first, then finishes the target (OHKO) after 0.38s
    spawnBombExplosion(opponent.x, opponent.y, rCfg.ohkoBlastRadius || 195, "pink", 12);
    spawnFloatingText(opponent.x, opponent.y - 100, "KILLER QUEEN: CLICK!", "#fde047", 26);
    state.pendingOhkos.push({ targetSlot: opponent.slot, casterSlot, timer: 0.38 });
  } else {
    const blastRadius = rCfg.groundBlastRadius || 160;
    spawnBombExplosion(bomb.x, bomb.y, blastRadius, "orange", 10);
    spawnFloatingText(bomb.x, bomb.y - 50, "CLICK!", "#fde047", 24);
    const dist = Math.hypot(opponent.x - bomb.x, opponent.y - bomb.y);
    if (!opponent.hidden && dist <= blastRadius + opponent.radius * 0.55) {
      applyAttackDamage(casterSlot, opponent, rCfg.groundDamage || 30, "#f472b6", true);
    }
  }
}

function startBarrage(caster, barrageCfg, skillKey = null, cdMax = 0, locked = false) {
  const cfg = barrageCfg || CHAR_CONFIG[caster.charId].barrage;
  const totalPunches = cfg.totalPunches;
  let soundKey = cfg.soundKey;
  if (caster.charId === "okuyasu") {
    soundKey = _okuyasuBarrageSoundIndex === 0 ? "okuyasuBarrage" : "okuyasuBarrage7Page";
    _okuyasuBarrageSoundIndex = 1 - _okuyasuBarrageSoundIndex;
  }
  const audioEntry = soundKey ? playSound(soundKey) : null;

  let totalDuration = 2.15;
  if (audioEntry && Number.isFinite(audioEntry.duration) && audioEntry.duration > 0.6) {
    totalDuration = Math.min(2.6, Math.max(1.4, audioEntry.duration * 0.9));
  }

  caster.barrageQueue = {
    remaining: totalPunches,
    timer: 0,
    interval: totalDuration / totalPunches,
    audioEntry,
    cfg,
    skillKey,
    cdMax,
    locked,
  };
  spawnFloatingText(caster.x, caster.y - 84, cfg.callout, cfg.color, 24);
}

function releaseBarrage(fighter) {
  if (!fighter || !fighter.barrageQueue || fighter.barrageQueue.locked) return;
  fadeOutAndStopAudio(fighter.barrageQueue.audioEntry, 120);
  if (fighter.charId === "polnareff") {
    for (const clone of state.polnareffClones) {
      if (clone.ownerSlot === fighter.slot) clone.barrageQueue = null;
    }
  }
  fighter.barrageQueue = null;
}

// ── New Character Skill Implementations (Diavolo, Okuyasu, Josuke, Polnareff, Jolyne) ──
function clampArenaX(x, r) {
  return Math.max(ARENA_LEFT + r, Math.min(ARENA_RIGHT - r, x));
}
function clampArenaY(y, r) {
  return Math.max(ARENA_TOP + r, Math.min(ARENA_BOTTOM - r, y));
}

function triggerTimeSkip(caster, opponent, cfg) {
  playSound(cfg.soundKey);
  spawnParticles(caster.x, caster.y, "#ef4444", 16, 220);
  let dx = 0;
  let dy = 0;
  if (caster.slot === "p1") {
    if (keysPressed.has("w")) dy -= 1;
    if (keysPressed.has("s")) dy += 1;
    if (keysPressed.has("a")) dx -= 1;
    if (keysPressed.has("d")) dx += 1;
    if (dx === 0 && dy === 0 && (Math.abs(touchInput.x) > 0.15 || Math.abs(touchInput.y) > 0.15)) {
      dx = touchInput.x;
      dy = touchInput.y;
    }
  } else {
    dx = opponent.x - caster.x;
    dy = opponent.y - caster.y;
  }
  if (dx === 0 && dy === 0) {
    dx = caster.facing || 1;
  }
  const len = Math.hypot(dx, dy) || 1;
  const dist = cfg.distance || 235;
  caster.x = clampArenaX(caster.x + (dx / len) * dist, caster.radius);
  caster.y = clampArenaY(caster.y + (dy / len) * dist, caster.radius);
  caster.facing = opponent.x >= caster.x ? 1 : -1;
  spawnParticles(caster.x, caster.y, "#dc2626", 20, 260);
  spawnFloatingText(caster.x, caster.y - 84, cfg.callout || "TIME SKIP!", "#ef4444", 24);
  state.screenShake = Math.max(state.screenShake, 5);

  const radius = cfg.impactRadius || 35;
  const zoneLife = 0.26;
  const hit = !(caster.slot === "p2" && state.aiDifficulty === "super") &&
    !opponent.hidden &&
    Math.hypot(opponent.x - caster.x, opponent.y - caster.y) <= radius + opponent.radius * 0.25;
  state.diavoloTimeSkipZones.push({
    casterSlot: caster.slot,
    x: caster.x,
    y: caster.y,
    radius,
    life: zoneLife,
    maxLife: zoneLife,
    hit,
  });
  if (!hit) return;

  const facing = caster.facing || 1;
  const wallX = clampArenaX(facing > 0 ? ARENA_RIGHT : ARENA_LEFT, opponent.radius);
  const flightSpeed = 3600;
  const distanceToWall = Math.abs(wallX - opponent.x);
  const alreadyAtWall = distanceToWall <= 1;
  const strikeDuration = 0.12;
  applyAttackDamage(caster.slot, opponent, cfg.impactDamage || 30, "#ef4444", true);
  playDiavoloTimeSkipImpact();
  opponent.barrageStunSlot = null;
  opponent.isGuarding = false;
  opponent.vx = 0;
  opponent.vy = 0;
  opponent.dashTimer = 0;
  opponent.knockbackTimer = 0;
  opponent.stunTimer = Math.max(
    opponent.stunTimer,
    alreadyAtWall ? (cfg.wallStunDuration || 0.5) : strikeDuration
  );
  if (opponent.barrageQueue) {
    fadeOutAndStopAudio(opponent.barrageQueue.audioEntry);
    opponent.barrageQueue = null;
  }
  state.diavoloImpales.push({
    casterSlot: caster.slot,
    targetSlot: opponent.slot,
    facing,
    wallX,
    phase: alreadyAtWall ? "pin" : "strike",
    timer: alreadyAtWall ? (cfg.wallStunDuration || 0.5) : strikeDuration,
    armTimer: 0.2,
    flightSpeed,
    pinDuration: cfg.wallStunDuration || 0.5,
  });
  if (alreadyAtWall) {
    opponent.x = wallX;
    opponent.stunTimer = Math.max(opponent.stunTimer, cfg.wallStunDuration || 0.5);
  }
  spawnParticles(opponent.x, opponent.y, "#ef4444", 14, 240);
  spawnFloatingText(opponent.x, opponent.y - 72, "KING CRIMSON: IMPALED!", "#ef4444", 19);
}

function activateEpitaph(caster, cfg) {
  caster.epitaphTimer = cfg.duration || 3.0;
  spawnParticles(caster.x, caster.y, "#ef4444", 16, 200);
  spawnFloatingText(caster.x, caster.y - 88, cfg.callout || "EPITAPH!", "#f87171", 24);
}

function triggerEpitaphCounter(diavolo) {
  const qCfg = CHAR_CONFIG.diavolo.skills.q;
  const attacker = getOpponent(diavolo.slot);
  diavolo.epitaphTimer = 0;
  playSound(qCfg.soundKey);
  playSound("diavoloBarrage", 0.65);
  spawnParticles(diavolo.x, diavolo.y, "#ef4444", 18, 250);

  // Teleport right in front of attacker
  const dir = attacker.x >= diavolo.x ? -1 : 1;
  diavolo.x = clampArenaX(attacker.x + dir * (attacker.radius + diavolo.radius + 8), diavolo.radius);
  diavolo.y = clampArenaY(attacker.y, diavolo.radius);
  diavolo.facing = attacker.x >= diavolo.x ? 1 : -1;

  const stunDuration = qCfg.stunDuration || 3.0;
  attacker.stunTimer = Math.max(attacker.stunTimer, stunDuration);
  attacker.barrageStunSlot = null;
  attacker.isGuarding = false;
  attacker.vx = 0;
  attacker.vy = 0;
  attacker.dashTimer = 0;
  attacker.knockbackTimer = 0;
  if (attacker.barrageQueue) {
    fadeOutAndStopAudio(attacker.barrageQueue.audioEntry);
    attacker.barrageQueue = null;
  }
  spawnParticles(attacker.x, attacker.y, "#dc2626", 22, 280);
  state.screenShake = Math.max(state.screenShake, 10);
  diavolo.vx = 0;
  diavolo.vy = 0;
  diavolo.dashTimer = 0;
  diavolo.knockbackTimer = 0;

  state.epitaphCounter = {
    casterSlot: diavolo.slot,
    targetSlot: attacker.slot,
    charId: "diavolo",
    color: "#dc2626",
    duration: stunDuration,
    remaining: stunDuration,
    damage: qCfg.damage || 50,
    punchTimer: 0,
    punchInterval: stunDuration / (CHAR_CONFIG.diavolo.epitaphBarrage.totalPunches || 42),
    punchesSpawned: 0,
    totalPunches: CHAR_CONFIG.diavolo.epitaphBarrage.totalPunches || 42,
  };
}

function updateScriptedBarrageCounter(counterKey, fistsKey, dt) {
  const counter = state[counterKey];
  if (!counter) return;

  counter.remaining = Math.max(0, counter.remaining - dt);
  counter.punchTimer -= dt;
  const caster = getFighter(counter.casterSlot);
  const target = getFighter(counter.targetSlot);
  if (!caster || !target || caster.hidden || target.hidden) {
    state[counterKey] = null;
    state[fistsKey].length = 0;
    return;
  }
  target.stunTimer = Math.max(target.stunTimer, counter.remaining);
  const baseAngle = Math.atan2(target.y - caster.y, target.x - caster.x);
  const charConfig = CHAR_CONFIG[counter.charId];

  while (counter.punchTimer <= 0 && counter.punchesSpawned < counter.totalPunches) {
    const angle = baseAngle + (Math.random() - 0.5) * 0.9;
    const offset = 16 + Math.random() * 42;
    target.hitFlash = Math.max(target.hitFlash, 0.05);
    if (counter.punchesSpawned % 4 === 0) {
      spawnParticles(target.x, target.y, counter.color, 3, 95);
    }
    if (counter.charId === "diavolo") {
      playBarragePunchImpact(counter.punchesSpawned === counter.totalPunches - 1 ? 1.45 : 1);
    }
    state[fistsKey].push({
      x: target.x - Math.cos(angle) * offset,
      y: target.y - Math.sin(angle) * offset,
      originX: target.x,
      originY: target.y,
      charId: counter.charId,
      vx: 0,
      vy: 0,
      angle,
      ownerSlot: caster.slot,
      color: charConfig.color,
      img: charConfig.armAsset(),
      life: counter.duration,
      maxLife: counter.duration,
      hit: false,
      suspended: true,
      isVisualOnly: true,
      isJolyneMobiusFist: counter.charId === "jolyne",
      damage: 0,
      scale: 1.0 + Math.random() * 0.25,
    });
    counter.punchesSpawned += 1;
    counter.punchTimer += counter.punchInterval;
  }

  if (counter.remaining > 0) return;

  state[counterKey] = null;
  state[fistsKey].length = 0;
  target.stunTimer = 0;
  state.screenShake = Math.max(state.screenShake, 8);
  spawnParticles(target.x, target.y, counter.color, 22, 300);
  spawnFloatingText(target.x, target.y - target.radius - 24, "FINISH!", counter.color, 24);
  applyAttackDamage(counter.casterSlot, target, counter.damage, counter.color, true);
}

function updateEpitaphCounter(dt) {
  updateScriptedBarrageCounter("epitaphCounter", "epitaphFists", dt);
}

function updateMobiusCounter(dt) {
  updateScriptedBarrageCounter("mobiusCounter", "mobiusFists", dt);
}

function spawnTheHandSwipeVfx(caster, angle) {
  state.eraseSwipes.push({
    x: caster.x + Math.cos(angle) * 68,
    y: caster.y + Math.sin(angle) * 68,
    angle,
    life: 0.28,
    maxLife: 0.28,
  });
}

function castTheHandPull(caster, opponent, cfg) {
  const angle = Math.atan2(opponent.y - caster.y, opponent.x - caster.x);
  playSound(cfg.soundKey);
  spawnTheHandSwipeVfx(caster, angle);
  spawnFloatingText(caster.x, caster.y - 84, cfg.callout, "#38bdf8", 22);

  const dist = Math.hypot(opponent.x - caster.x, opponent.y - caster.y);
  if (dist <= (cfg.range || 210) + opponent.radius && !opponent.hidden) {
    if (opponent.dashTimer > 0) {
      spawnFloatingText(opponent.x, opponent.y - 72, "NÉ ĐƯỢC!", "#4ade80", 20);
      return;
    }
    const pullX = clampArenaX(caster.x + Math.cos(angle) * (caster.radius + opponent.radius + 2), opponent.radius);
    const pullY = clampArenaY(caster.y + Math.sin(angle) * (caster.radius + opponent.radius + 2), opponent.radius);
    if (opponent.sealedTimer <= 0) {
      opponent.x = pullX;
      opponent.y = pullY;
    }
    applyAttackDamage(caster.slot, opponent, cfg.damage || 10, "#38bdf8", false);
    opponent.stunTimer = Math.max(opponent.stunTimer, cfg.stunDuration || 0);
    opponent.barrageStunSlot = null;
    opponent.isGuarding = false;
    opponent.vx = 0;
    opponent.vy = 0;
    opponent.dashTimer = 0;
    opponent.knockbackTimer = 0;
    if (opponent.barrageQueue) {
      fadeOutAndStopAudio(opponent.barrageQueue.audioEntry);
      opponent.barrageQueue = null;
    }
    spawnParticles(opponent.x, opponent.y, "#38bdf8", 16, 220);
    spawnFloatingText(opponent.x, opponent.y - 72, "KÉO LẠI!", "#38bdf8", 20);
  }
}

function castTheHandSpaceErase(caster, opponent, cfg) {
  spawnFloatingText(caster.x, caster.y - 88, cfg.callout, "#38bdf8", 24);
  const swipes = cfg.swipes || 3;
  const interval = cfg.interval || 0.2;
  for (let i = 0; i < swipes; i++) {
    state.theHandQueue.push({
      casterSlot: caster.slot,
      delay: i * interval,
      isLast: i === swipes - 1,
      damage: i === swipes - 1 ? (cfg.lastSwipeDamage || 16) : (cfg.damagePerSwipe || 12),
      stunDuration: cfg.stunDuration || 0.2,
      range: cfg.range || 205,
      soundKey: cfg.soundKey,
    });
  }
}

function castJosukeRock(caster, opponent, cfg) {
  playSound(cfg.soundKey);
  const angle = Math.atan2(opponent.y - caster.y, opponent.x - caster.x);
  const crackX = clampArenaX(caster.x + Math.cos(angle) * 48, 24);
  const crackY = clampArenaY(caster.y + Math.sin(angle) * 48, 24);

  state.groundCracks.push({
    x: crackX,
    y: crackY,
    angle,
    life: 0.9,
    maxLife: 0.9,
  });
  spawnParticles(crackX, crackY, "#94a3b8", 16, 200);
  spawnParticles(crackX, crackY, "#d6d3d1", 12, 140);
  spawnFloatingText(caster.x, caster.y - 84, cfg.callout, "#f472b6", 22);
  state.screenShake = Math.max(state.screenShake, 7);

  state.josukeRocks.push({
    casterSlot: caster.slot,
    x: crackX,
    y: crackY,
    originX: crackX,
    originY: crackY,
    angle,
    speed: cfg.speed || 430,
    maxRange: cfg.maxRange || 340,
    damage: cfg.damage || 15,
    phase: "out",
    hit: false,
    targetSlot: null,
    radius: 26,
  });
}

function castJosukeAngelo(caster, opponent, cfg) {
  const angle = Math.atan2(opponent.y - caster.y, opponent.x - caster.x);
  spawnFloatingText(caster.x, caster.y - 88, cfg.callout, "#f472b6", 24);
  state.angeloPunches.push({
    casterSlot: caster.slot,
    x: caster.x + Math.cos(angle) * 40,
    y: caster.y + Math.sin(angle) * 40,
    originX: caster.x,
    originY: caster.y,
    angle,
    speed: 780,
    maxRange: cfg.maxRange || 255,
    damage: cfg.damage || 35,
    sealDuration: cfg.sealDuration || 2.0,
    hit: false,
  });
}

function castPolnareffSword(caster, opponent, cfg, isVisualOnly = false, damageMultiplier = 1, silent = isVisualOnly) {
  if (!silent) {
    playSound(cfg.soundKey);
    spawnFloatingText(caster.x, caster.y - 84, cfg.callout, "#e2e8f0", 22);
  }
  const angle = Math.atan2(opponent.y - caster.y, opponent.x - caster.x);
  const speed = cfg.speed || 760;
  state.swordProjectiles.push({
    casterSlot: caster.slot,
    x: caster.x + Math.cos(angle) * 40,
    y: caster.y + Math.sin(angle) * 40,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    damage: isVisualOnly ? 0 : (cfg.damage || 10) * damageMultiplier,
    drawSize: cfg.projectileSize || 155,
    isVisualOnly,
    life: 1.4,
  });
}

function activatePolnareffArmorOff(caster, cfg) {
  playSound(cfg.soundKey);
  caster.armorOffTimer = cfg.duration || 10;
  spawnParticles(caster.x, caster.y, "#e2e8f0", 24, 280);
  spawnFloatingText(caster.x, caster.y - 90, cfg.callout || "ARMOR OFF!", "#f8fafc", 25);

  // Spawn two afterimages for the full Armor Off duration.
  state.polnareffClones = state.polnareffClones.filter((c) => c.ownerSlot !== caster.slot);
  for (let i = 0; i < 2; i++) {
    const ang = (i === 0 ? -1 : 1) * 1.1;
    const cloneHp = Math.max(25, Math.round(caster.maxHp * 0.35));
    state.polnareffClones.push({
      ownerSlot: caster.slot,
      slot: `polnareff-clone-${caster.slot}-${++state.polnareffCloneSerial}`,
      isPolnareffClone: true,
      charId: "polnareff",
      img: caster.img,
      x: clampArenaX(caster.x + Math.cos(ang) * 90, caster.radius),
      y: clampArenaY(caster.y + Math.sin(ang) * 90, caster.radius),
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      facing: caster.facing,
      radius: caster.radius,
      hp: cloneHp,
      maxHp: cloneHp,
      hitFlash: 0,
      guardPool: 0,
      isGuarding: false,
      stunTimer: 0,
      sealedTimer: 0,
      dashTimer: 0,
      knockbackTimer: 0,
      barrageStunSlot: null,
      timeStopPendingDmg: 0,
      timeStopPendingColor: "#ff4d4f",
      timeStopPendingHeavy: false,
      timeStopPendingKnockback: null,
      hidden: false,
      life: cfg.duration || 10,
      side: i === 0 ? -1 : 1,
      barrageQueue: null,
    });
  }
}

function triggerCloneSkill(caster, opponent, key) {
  if (caster.charId !== "polnareff" || caster.armorOffTimer <= 0) return;

  for (const clone of state.polnareffClones) {
    if (clone.ownerSlot !== caster.slot) continue;

    if (key === "e") {
      const barrage = CHAR_CONFIG.polnareff.barrage;
      clone.barrageQueue = {
        remaining: barrage.totalPunches,
        timer: 0,
        interval: caster.barrageQueue?.interval || 2.15 / barrage.totalPunches,
        cfg: {
          ...barrage,
          punchDamage: barrage.punchDamage * 0.1,
          lastPunchDamage: barrage.lastPunchDamage * 0.1,
        },
      };
    } else if (key === "r") {
      castPolnareffSword(
        clone,
        opponent,
        CHAR_CONFIG.polnareff.skills.r,
        false,
        0.1,
        true
      );
    }
  }
}

function castJolyneStringFinger(caster, opponent, cfg) {
  playSound(cfg.soundKey);
  const angle = Math.atan2(opponent.y - caster.y, opponent.x - caster.x);
  state.stringFingers.push({
    casterSlot: caster.slot,
    x1: caster.x,
    y1: caster.y,
    angle,
    length: 30,
    maxLength: cfg.maxLength || 255,
    life: cfg.life || 0.38,
    maxLife: cfg.life || 0.38,
    damage: cfg.damage || 10,
    stunDuration: cfg.stunDuration || 0.5,
    phase: "extend",
    hitDone: false,
  });
  spawnFloatingText(caster.x, caster.y - 84, cfg.callout, "#22d3ee", 22);
}

function castJolyneMobiusWeb(caster, opponent, cfg) {
  caster.jolynePoseTimer = 0.45;
  const angle = Math.atan2(opponent.y - caster.y, opponent.x - caster.x);
  const dist = Math.min(cfg.range || 250, Math.hypot(opponent.x - caster.x, opponent.y - caster.y));
  const tx = clampArenaX(caster.x + Math.cos(angle) * dist, 70);
  const ty = clampArenaY(caster.y + Math.sin(angle) * dist, 70);
  state.mobiusWebs.push({
    casterSlot: caster.slot,
    x: caster.x,
    y: caster.y,
    targetX: tx,
    targetY: ty,
    speed: cfg.projectileSpeed || 546,
    radius: cfg.webRadius || 88,
    damage: cfg.damage || 40,
    life: cfg.webDuration || 2.0,
    landed: false,
    triggered: false,
  });
  spawnFloatingText(caster.x, caster.y - 88, cfg.callout, "#22d3ee", 24);
}

function startMobiusCounter(caster, target, cfg) {
  const duration = 2.15;
  const totalPunches = 40;
  target.stunTimer = duration;
  target.barrageStunSlot = null;
  target.isGuarding = false;
  target.vx = 0;
  target.vy = 0;
  target.dashTimer = 0;
  target.knockbackTimer = 0;
  if (target.barrageQueue) {
    fadeOutAndStopAudio(target.barrageQueue.audioEntry);
    target.barrageQueue = null;
  }

  caster.vx = 0;
  caster.vy = 0;
  caster.dashTimer = 0;
  caster.knockbackTimer = 0;
  spawnFloatingText(caster.x, caster.y - 84, "ORA ORA ORA!", "#22d3ee", 24);
  state.mobiusCounter = {
    casterSlot: caster.slot,
    targetSlot: target.slot,
    charId: "jolyne",
    color: "#22d3ee",
    duration,
    remaining: duration,
    damage: cfg.damage || 40,
    punchTimer: 0,
    punchInterval: duration / totalPunches,
    punchesSpawned: 0,
    totalPunches,
  };
}

function activateTimeStop(casterSlot, duration) {
  const caster = getFighter(casterSlot);
  state.timeStop = {
    active: true,
    casterSlot,
    remaining: duration,
    duration,
    rippleRadius: 12,
  };
  timestopLabel.textContent = `${CHAR_CONFIG[caster.charId].name}: ZA WARUDO!`;
  timestopTimer.textContent = `${duration.toFixed(1)}s`;
  timestopBanner.classList.remove("hidden");
  state.screenShake = 7;
}

function releaseSuspendedTimeStopPunches() {
  let released = 0;
  for (const p of state.punches) {
    if (!p.suspended) continue;
    p.suspended = false;
    released++;
    const target = getOpponent(p.ownerSlot);
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    const burstSpeed = 920;
    p.angle = angle;
    p.vx = Math.cos(angle) * burstSpeed;
    p.vy = Math.sin(angle) * burstSpeed;
    p.life = 0.45;
    p.maxLife = 0.45;
  }
  if (released > 0) {
    state.screenShake = Math.max(state.screenShake, 10);
  }
}

function releaseTimeStopDamage(casterSlot) {
  const priority = casterSlot ? [getOpponent(casterSlot), getFighter(casterSlot)] : [];
  const order = [...new Set([...priority, state.p1, state.p2, ...state.polnareffClones])].filter(Boolean);
  let anyReleased = false;

  for (const f of order) {
    if (!f || f.timeStopPendingDmg <= 0) continue;
    anyReleased = true;
    const totalDmg = Math.round(f.timeStopPendingDmg * 10) / 10;
    const pendingColor = f.timeStopPendingColor || "#ef4444";
    f.timeStopPendingDmg = 0;
    f.timeStopPendingColor = "#ff4d4f";
    f.timeStopPendingHeavy = false;

    f.hp = Math.max(0, Math.round((f.hp - totalDmg) * 10) / 10);
    f.hitFlash = 0.28;

    spawnParticles(f.x, f.y, pendingColor, 24, 360);
    spawnParticles(f.x, f.y, "#ffffff", 10, 260);
    state.screenShake = Math.max(state.screenShake, totalDmg >= 35 ? 14 : 9);

    const pctLoss = ((totalDmg / f.maxHp) * 100).toFixed(1);
    const dmgLabel = totalDmg >= f.maxHp ? "OHKO!" : `-${pctLoss}%`;
    spawnFloatingText(f.x, f.y - f.radius - 18, dmgLabel, pendingColor, totalDmg >= 25 ? 28 : 21);
  }

  if (anyReleased) {
    updateHpUI();
    for (const f of order) {
      if (f?.isPolnareffClone && f.hp <= 0) {
        f.hidden = true;
        f.life = 0;
        continue;
      }
      if (f && !f.isPolnareffClone && f.hp <= 0 && !state.gameOver) {
        endGame(f.slot === "p2" ? "p1" : "p2");
        break;
      }
    }
  }

  for (const f of order) {
    if (!f || !f.timeStopPendingKnockback) continue;
    const kb = f.timeStopPendingKnockback;
    f.timeStopPendingKnockback = null;
    f.x = Math.max(ARENA_LEFT + f.radius, Math.min(ARENA_RIGHT - f.radius, f.x + kb.nx * 28));
    f.y = Math.max(ARENA_TOP + f.radius, Math.min(ARENA_BOTTOM - f.radius, f.y + kb.ny * 28));
    f.vx = kb.vx;
    f.vy = kb.vy;
    f.knockbackTimer = kb.timer;
    f.isGuarding = false;
    spawnFloatingText(f.x, f.y - f.radius - 30, "ĐÁNH BAY!", "#facc15", 22);
  }
}

function spawnBarragePunch(fighter, opponent, isLastPunch, overrideCfg = null) {
  const baseAngle = Math.atan2(opponent.y - fighter.y, opponent.x - fighter.x);

  const barrageCfg = overrideCfg || fighter.barrageQueue?.cfg || CHAR_CONFIG[fighter.charId].barrage;
  const punchDmg = isLastPunch ? barrageCfg.lastPunchDamage : barrageCfg.punchDamage;
  if (fighter.charId === "diavolo" || fighter.charId === "okuyasu") {
    playBarragePunchImpact(isLastPunch ? 1.45 : 1);
  }

  if (barrageCfg.isFanSword) {
    // Polnareff Silver Chariot: tight horizontal fan (±20px vertical, ±5°) for anime hundred-thrust look
    const count = state.punches.length > 34 ? 2 : 3;
    for (let n = 0; n < count; n++) {
      const isVisualOnly = n > 0;
      const angleJitter = ((Math.random() - 0.5) * 10 * Math.PI) / 180; // ±5 deg
      const spreadAngle = baseAngle + angleJitter;
      const perpAngle = baseAngle + Math.PI / 2;
      const lateralOffset = (Math.random() - 0.5) * 40; // ±20px
      const forwardOffset = 26 + Math.random() * 24;
      const startX = fighter.x + Math.cos(baseAngle) * forwardOffset + Math.cos(perpAngle) * lateralOffset;
      const startY = fighter.y + Math.sin(baseAngle) * forwardOffset + Math.sin(perpAngle) * lateralOffset;
      const speed = 520 + Math.random() * 90;
      const maxLife = 0.16;
      if (state.punches.length < 48) {
        state.punches.push({
          x: startX,
          y: startY,
          originX: fighter.x,
          originY: fighter.y,
          vx: Math.cos(spreadAngle) * speed,
          vy: Math.sin(spreadAngle) * speed,
          angle: spreadAngle,
          ownerSlot: fighter.slot,
          color: barrageCfg.color || CHAR_CONFIG[fighter.charId].color,
          img: CHAR_CONFIG[fighter.charId].armAsset(),
          life: maxLife,
          maxLife,
          hit: false,
          suspended: false,
          isVisualOnly,
          damage: isVisualOnly ? 0 : punchDmg,
          charId: fighter.charId,
          scale: 1.05 + Math.random() * 0.2,
        });
      }
    }
    return;
  }

  // Spawn 1 real damaging punch + 1 visual-only punch for a dense, smooth 60fps rush
  const punchCount = state.punches.length > 36 ? 1 : 2;
  for (let n = 0; n < punchCount; n++) {
    const isVisualOnly = n > 0;
    const spreadAngle = baseAngle + (Math.random() - 0.5) * 0.85;
    const perpAngle = baseAngle + Math.PI / 2;
    const lateralOffset = (Math.random() - 0.5) * 110;
    const forwardOffset = 28 + Math.random() * 28;

    const startX =
      fighter.x + Math.cos(baseAngle) * forwardOffset + Math.cos(perpAngle) * lateralOffset;
    const startY =
      fighter.y + Math.sin(baseAngle) * forwardOffset + Math.sin(perpAngle) * lateralOffset;

    const speed = 460 + Math.random() * 90;
    const maxLife = 0.17; // True short melee range!
    if (state.punches.length < 44) {
      state.punches.push({
        x: startX,
        y: startY,
        originX: fighter.x,
        originY: fighter.y,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed,
        angle: spreadAngle,
        ownerSlot: fighter.slot,
        color: barrageCfg.color || CHAR_CONFIG[fighter.charId].color,
        img: CHAR_CONFIG[fighter.charId].armAsset(),
        life: maxLife,
        maxLife,
        hit: false,
        suspended: false,
        isVisualOnly,
        damage: isVisualOnly ? 0 : punchDmg,
        charId: fighter.charId,
        scale: (isVisualOnly ? 1.0 : 1.2) + Math.random() * 0.28,
      });
    }
  }
}

// ── Physics & Update Loop ───────────────────────────────────
function updateFighterPhysics(f, dt) {
  if (f.hidden || isFrozen(f.slot)) return;

  if (f.guardBrokenTimer > 0) {
    f.guardBrokenTimer = Math.max(0, f.guardBrokenTimer - dt);
  }

  if (f.stunTimer > 0) {
    f.stunTimer = Math.max(0, f.stunTimer - dt);
  }
  if (f.sealedTimer > 0) {
    f.sealedTimer = Math.max(0, f.sealedTimer - dt);
    f.knockbackTimer = 0;
    f.dashTimer = 0;
    f.vx = 0;
    f.vy = 0;
  }
  if (f.epitaphTimer > 0) {
    f.epitaphTimer = Math.max(0, f.epitaphTimer - dt);
  }
  if (f.armorOffTimer > 0) {
    f.armorOffTimer = Math.max(0, f.armorOffTimer - dt);
  }
  if (f.jolynePoseTimer > 0) {
    f.jolynePoseTimer = Math.max(0, f.jolynePoseTimer - dt);
  }

  // Periodic character voice lines (Okuyasu every 25s, Josuke & Jolyne occasionally)
  if (f.charId === "okuyasu" || f.charId === "josuke" || f.charId === "jolyne") {
    f.voiceTimer -= dt;
    if (f.voiceTimer <= 0) {
      if (f.charId === "okuyasu") {
        f.voiceTimer = 25;
        playSound("okuyasuVoice");
      } else if (f.charId === "josuke") {
        f.voiceTimer = 22 + Math.random() * 8;
        playSound("josukeVoice");
      } else {
        f.voiceTimer = 22 + Math.random() * 8;
        playSound("jolyneVoice");
      }
    }
  }

  // Guard state & gradual recharge (25 damage pool, 4s lock when broken, 40s full recharge)
  const wantsGuard =
    f.slot === "p1" ? keysPressed.has("f") || touchInput.guarding : state.aiGuardTimer > 0;
  if (
    wantsGuard &&
    f.guardBrokenTimer <= 0 &&
    f.guardPool > 0.2 &&
    f.biteTheDustCharge <= 0 &&
    f.stunTimer <= 0 &&
    f.sealedTimer <= 0 &&
    f.knockbackTimer <= 0 &&
    !f.isChargingTimeStop
  ) {
    f.isGuarding = true;
    f.guardRegenDelay = 1.0;
  } else {
    f.isGuarding = false;
    if (f.guardBrokenTimer <= 0) {
      if (f.guardRegenDelay > 0) {
        f.guardRegenDelay = Math.max(0, f.guardRegenDelay - dt);
      } else {
        f.guardPool = Math.min(
          MAX_GUARD_POOL,
          f.guardPool + (MAX_GUARD_POOL / GUARD_FULL_RECHARGE_SECONDS) * dt
        );
      }
    }
  }

  // Bite The Dust Charge (reads stats from characters/kira.js)
  if (f.biteTheDustCharge > 0) {
    f.biteTheDustCharge -= dt;
    if (f.biteTheDustCharge <= 0) {
      f.biteTheDustCharge = 0;
      const btdCfg = CHAR_CONFIG.kira.skills.q;
      const healPct = btdCfg.healPct || 0.2;
      const healAmount = f.maxHp * healPct;
      f.hp = Math.min(f.maxHp, f.hp + healAmount);
      f.biteTheDustChargeDuration = 0;
      playSound(btdCfg.soundKey);
      spawnParticles(f.x, f.y, "#4ade80", 24, 230);
      spawnParticles(f.x, f.y, "#f472b6", 12, 150);
      spawnFloatingText(f.x, f.y - f.radius - 20, `+${Math.round(healPct * 100)}% HP!`, "#4ade80", 28);
      state.screenShake = Math.max(state.screenShake, 3);
      updateHpUI();
    }
    return;
  }

  const isRooted =
    f.barrageQueue?.rooted ||
    state.epitaphCounter?.casterSlot === f.slot ||
    state.mobiusCounter?.casterSlot === f.slot ||
    Boolean(getActiveBarrageStunner(f));
  if (isRooted) {
    f.vx = 0;
    f.vy = 0;
    f.dashTimer = 0;
    f.knockbackTimer = 0;
  } else if (f.knockbackTimer > 0) {
    f.knockbackTimer = Math.max(0, f.knockbackTimer - dt);
    const drag = Math.max(0, 1 - dt * 3.4);
    f.vx *= drag;
    f.vy *= drag;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (Math.random() < 0.55) {
      spawnParticles(f.x, f.y, "#fde047", 1, 90);
    }
  } else if (f.dashTimer > 0) {
    f.dashTimer = Math.max(0, f.dashTimer - dt);
    f.dashEchoTimer -= dt;
    if (f.dashEchoTimer <= 0) {
      spawnDashAfterimage(f);
      f.dashEchoTimer = 0.035;
    }
    f.x += f.dashVx * dt;
    f.y += f.dashVy * dt;
  } else if (f.isChargingTimeStop) {
    // Hold Q for 1s to activate Za Warudo (slowed drift, interrupted if taking damage)
    f.timeStopCharge += dt;
    const damp = Math.max(0, 1 - dt * 5);
    f.vx *= damp;
    f.vy *= damp;
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    if (f.timeStopCharge >= f.timeStopChargeMax) {
      f.isChargingTimeStop = false;
      f.timeStopCharge = 0;
      const charModule = CHAR_CONFIG[f.charId];
      const qCfg = charModule.skills.q;
      state.cooldowns[f.slot].q = qCfg.cd;
      charModule.castSkill(
        {
          state,
          playSound,
          fadeOutAndStopAudio,
          activateTimeStop,
          startBarrage,
          plantFirstBomb,
          spawnFloatingText,
        },
        f.slot,
        f,
        getOpponent(f.slot),
        "q"
      );
    }
  } else if (f.sealedTimer > 0 || f.stunTimer > 0) {
    // Sealed (Angelo Stone) or Stunned: cannot steer, rapidly decelerates
    const damp = Math.max(0, 1 - dt * 10);
    f.vx *= damp;
    f.vy *= damp;
    if (f.sealedTimer <= 0) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }
  } else {
    const speedMult = f.charId === "polnareff" && f.armorOffTimer > 0 ? (CHAR_CONFIG.polnareff.skills.q.speedMult || 1.5) : 1.0;
    if (f.slot === "p1") {
      let ax = 0;
      let ay = 0;
      if (keysPressed.has("w")) ay -= 1;
      if (keysPressed.has("s")) ay += 1;
      if (keysPressed.has("a")) ax -= 1;
      if (keysPressed.has("d")) ax += 1;

      if (ax === 0 && ay === 0 && (Math.abs(touchInput.x) > 0.08 || Math.abs(touchInput.y) > 0.08)) {
        ax = touchInput.x;
        ay = touchInput.y;
      }

      if (ax !== 0 || ay !== 0) {
        const len = Math.hypot(ax, ay);
        ax /= len;
        ay /= len;
        const accel = (f.isGuarding ? 460 : 800) * speedMult;
        f.vx += ax * accel * dt;
        f.vy += ay * accel * dt;

        const spd = Math.hypot(f.vx, f.vy);
        const maxSpd = (f.isGuarding ? 165 : 250) * speedMult;
        if (spd > maxSpd) {
          f.vx = (f.vx / spd) * maxSpd;
          f.vy = (f.vy / spd) * maxSpd;
        }
      } else {
        const spd = Math.hypot(f.vx, f.vy);
        if (spd > 190) {
          const factor = Math.max(180 / spd, 1 - dt * 1.8);
          f.vx *= factor;
          f.vy *= factor;
        }
      }
    } else {
      // Smart AI Steering!
      applyAiSteering(f, dt);
    }

    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }

  if (Math.abs(f.vx) > 15) {
    f.facing = f.vx >= 0 ? 1 : -1;
  }

  // Rectangular arena wall bounces
  let bounced = false;
  let bx = f.x;
  let by = f.y;

  if (f.x - f.radius <= ARENA_LEFT) {
    f.x = ARENA_LEFT + f.radius;
    if (f.vx < 0) {
      f.vx = -f.vx;
      bounced = true;
      bx = ARENA_LEFT;
    }
  } else if (f.x + f.radius >= ARENA_RIGHT) {
    f.x = ARENA_RIGHT - f.radius;
    if (f.vx > 0) {
      f.vx = -f.vx;
      bounced = true;
      bx = ARENA_RIGHT;
    }
  }

  if (f.y - f.radius <= ARENA_TOP) {
    f.y = ARENA_TOP + f.radius;
    if (f.vy < 0) {
      f.vy = -f.vy;
      bounced = true;
      by = ARENA_TOP;
    }
  } else if (f.y + f.radius >= ARENA_BOTTOM) {
    f.y = ARENA_BOTTOM - f.radius;
    if (f.vy > 0) {
      f.vy = -f.vy;
      bounced = true;
      by = ARENA_BOTTOM;
    }
  }

  if (bounced) {
    const jitter = (Math.random() - 0.5) * 0.16;
    const c = Math.cos(jitter);
    const s = Math.sin(jitter);
    const nvx = f.vx * c - f.vy * s;
    const nvy = f.vx * s + f.vy * c;
    f.vx = nvx;
    f.vy = nvy;

    const spd = Math.hypot(f.vx, f.vy) || 1;
    if (spd < 180) {
      f.vx = (f.vx / spd) * 180;
      f.vy = (f.vy / spd) * 180;
    }
    spawnParticles(bx, by, CHAR_CONFIG[f.charId].color, 5, 110);
  }
}

function applyAiSteering(ai, dt) {
  const diff = getActiveAiDiff();
  const player = getOpponent("p2");
  const lead = diff.leadAim || 0;
  const aimX = Math.max(ARENA_LEFT + player.radius, Math.min(ARENA_RIGHT - player.radius, player.x + player.vx * lead));
  const aimY = Math.max(ARENA_TOP + player.radius, Math.min(ARENA_BOTTOM - player.radius, player.y + player.vy * lead));

  const dx = aimX - ai.x;
  const dy = aimY - ai.y;
  const dist = Math.hypot(player.x - ai.x, player.y - ai.y) || 1;
  const aimDist = Math.hypot(dx, dy) || 1;
  const nx = dx / aimDist;
  const ny = dy / aimDist;
  const rawNx = (player.x - ai.x) / dist;
  const rawNy = (player.y - ai.y) / dist;

  state.aiStrafeSwitchTimer -= dt;
  if (state.aiStrafeSwitchTimer <= 0) {
    state.aiStrafeSwitchTimer = diff.id === "super" ? 0.55 + Math.random() * 0.55 : 1.0 + Math.random() * 0.9;
    state.aiStrafeDir = Math.random() < 0.5 ? 1 : -1;
  }

  let steerX = 0;
  let steerY = 0;

  const floorBomb = state.firstBombs.find((b) => b.ownerSlot === "p1" && !b.attachedSlot);
  const bombDist = floorBomb ? Math.hypot(ai.x - floorBomb.x, ai.y - floorBomb.y) : 9999;
  const enemyBeam = diff.id === "super" || diff.id === "hard"
    ? state.starFingerBeams.find((b) => b.casterSlot === "p1")
    : null;

  if (
    (diff.id === "super" || diff.id === "hard") &&
    state.roadRoller.active &&
    state.roadRoller.casterSlot === "p1" &&
    Math.hypot(ai.x - state.roadRoller.targetX, ai.y - state.roadRoller.targetY) < state.roadRoller.impactRadius + ai.radius + 32
  ) {
    // Dodge outside Road Roller impact circle
    const rx = ai.x - state.roadRoller.targetX;
    const ry = ai.y - state.roadRoller.targetY;
    const rl = Math.hypot(rx, ry) || 1;
    steerX = rx / rl;
    steerY = ry / rl;
  } else if (enemyBeam && dist < 250) {
    // Sidestep perpendicularly away from Star Finger trajectory
    const px = -Math.sin(enemyBeam.angle);
    const py = Math.cos(enemyBeam.angle);
    const side = (ai.x - enemyBeam.x1) * px + (ai.y - enemyBeam.y1) * py >= 0 ? 1 : -1;
    steerX = px * side;
    steerY = py * side;
  } else if (floorBomb && bombDist < (diff.id === "easy" ? 95 : 175)) {
    const bx = ai.x - floorBomb.x;
    const by = ai.y - floorBomb.y;
    const bl = Math.hypot(bx, by) || 1;
    steerX = bx / bl;
    steerY = by / bl;
  } else if (state.timeStop.active && state.timeStop.casterSlot === "p2") {
    // Time Stop active for AI: rush directly onto frozen player!
    steerX = rawNx;
    steerY = rawNy;
  } else if (ai.charId === "kira" && diff.id !== "easy") {
    const aiBomb = state.firstBombs.find((b) => b.ownerSlot === "p2" && !b.attachedSlot);
    if (aiBomb) {
      if (diff.id === "super") {
        // Super Kira chases aggressively and gets behind the player, pushing them toward the bomb.
        const fromBombX = player.x - aiBomb.x;
        const fromBombY = player.y - aiBomb.y;
        const fromBombDist = Math.hypot(fromBombX, fromBombY) || 1;
        const pushDirX = fromBombX / fromBombDist;
        const pushDirY = fromBombY / fromBombDist;
        const pressTargetX = Math.max(
          ARENA_LEFT + 64,
          Math.min(ARENA_RIGHT - 64, player.x + pushDirX * 82)
        );
        const pressTargetY = Math.max(
          ARENA_TOP + 64,
          Math.min(ARENA_BOTTOM - 64, player.y + pushDirY * 82)
        );
        const px = pressTargetX - ai.x;
        const py = pressTargetY - ai.y;
        const pd = Math.hypot(px, py) || 1;
        steerX = (px / pd) * 0.88 - rawNy * 0.34 * state.aiStrafeDir;
        steerY = (py / pd) * 0.88 + rawNx * 0.34 * state.aiStrafeDir;
      } else {
        // Medium/Hard Kira still uses a controlled anchor position around the trap.
        const bdx = aiBomb.x - player.x;
        const bdy = aiBomb.y - player.y;
        const bd = Math.hypot(bdx, bdy) || 1;
        const anchorX = Math.max(ARENA_LEFT + 60, Math.min(ARENA_RIGHT - 60, aiBomb.x + (bdx / bd) * 95));
        const anchorY = Math.max(ARENA_TOP + 60, Math.min(ARENA_BOTTOM - 60, aiBomb.y + (bdy / bd) * 95));
        const ax = anchorX - ai.x;
        const ay = anchorY - ai.y;
        const ad = Math.hypot(ax, ay) || 1;
        steerX = ad > 24 ? ax / ad : -rawNy * state.aiStrafeDir;
        steerY = ad > 24 ? ay / ad : rawNx * state.aiStrafeDir;
      }
    } else if (player.barrageQueue && dist < 175) {
      steerX = -rawNx * 0.72 - rawNy * 0.65 * state.aiStrafeDir;
      steerY = -rawNy * 0.72 + rawNx * 0.65 * state.aiStrafeDir;
    } else if (dist > 165) {
      steerX = nx * 0.92 - rawNy * 0.3 * state.aiStrafeDir;
      steerY = ny * 0.92 + rawNx * 0.3 * state.aiStrafeDir;
    } else if (dist < 105) {
      steerX = -rawNx * 0.65 - rawNy * 0.75 * state.aiStrafeDir;
      steerY = -rawNy * 0.65 + rawNx * 0.75 * state.aiStrafeDir;
    } else {
      steerX = -rawNy * state.aiStrafeDir * 0.9 + nx * 0.2;
      steerY = rawNx * state.aiStrafeDir * 0.9 + ny * 0.2;
    }
  } else if (player.barrageQueue && dist < 175 && diff.id !== "easy") {
    // Kite sideways & out of player's melee barrage
    steerX = -rawNx * 0.72 - rawNy * 0.65 * state.aiStrafeDir;
    steerY = -rawNy * 0.72 + rawNx * 0.65 * state.aiStrafeDir;
  } else if (diff.id === "super") {
    const cds = state.cooldowns.p2;
    const attackReady =
      (ai.charId === "dio" && (cds.e <= 0.4 || cds.q <= 0.4)) ||
      (ai.charId === "jotaro" && (cds.r <= 0.4 || cds.q <= 0.4 || cds.e <= 0.4)) ||
      (ai.charId === "kira" && (cds.e <= 0.4 || cds.r <= 0.4));
    const idealDist = attackReady ? 125 : 195;
    if (dist > idealDist + 25) {
      steerX = nx * 0.92 - rawNy * 0.32 * state.aiStrafeDir;
      steerY = ny * 0.92 + rawNx * 0.32 * state.aiStrafeDir;
    } else if (dist < idealDist - 25 && !attackReady) {
      steerX = -rawNx * 0.65 - rawNy * 0.75 * state.aiStrafeDir;
      steerY = -rawNy * 0.65 + rawNx * 0.75 * state.aiStrafeDir;
    } else {
      steerX = -rawNy * state.aiStrafeDir * 0.92 + nx * 0.2;
      steerY = rawNx * state.aiStrafeDir * 0.92 + ny * 0.2;
    }
  } else if (dist > 155) {
    steerX = nx;
    steerY = ny;
  } else {
    steerX = -rawNy * state.aiStrafeDir * 0.85 + rawNx * 0.25;
    steerY = rawNx * state.aiStrafeDir * 0.85 + rawNy * 0.25;
  }

  const len = Math.hypot(steerX, steerY) || 1;
  const accel = ai.isGuarding ? Math.round(diff.accel * 0.58) : diff.accel;
  ai.vx += (steerX / len) * accel * dt;
  ai.vy += (steerY / len) * accel * dt;

  const maxSpd = ai.isGuarding ? Math.round(diff.maxSpeed * 0.65) : diff.maxSpeed;
  const spd = Math.hypot(ai.vx, ai.vy);
  if (spd > maxSpd) {
    ai.vx = (ai.vx / spd) * maxSpd;
    ai.vy = (ai.vy / spd) * maxSpd;
  }
}

function handleFighterCollision() {
  const a = state.p1;
  const b = state.p2;
  if (a.hidden || b.hidden) return;
  if (getActiveBarrageStunner(a) || getActiveBarrageStunner(b)) return;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.radius + b.radius;

  if (dist < minDist && dist > 0.001) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    // Approach speeds along collision normal BEFORE separation
    const aApproach = a.vx * nx + a.vy * ny + (a.dashTimer > 0 ? 500 : 0);
    const bApproach = -(b.vx * nx + b.vy * ny) + (b.dashTimer > 0 ? 500 : 0);

    const aFrozen = isFrozen("p1");
    const bFrozen = isFrozen("p2");

    if (!aFrozen && !bFrozen) {
      const aBarraging = Boolean(a.barrageQueue);
      const bBarraging = Boolean(b.barrageQueue);

      if (!aBarraging && !bBarraging) {
        a.x -= nx * (overlap * 0.5);
        a.y -= ny * (overlap * 0.5);
        b.x += nx * (overlap * 0.5);
        b.y += ny * (overlap * 0.5);

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velAlongNormal = rvx * nx + rvy * ny;
        if (velAlongNormal < 0) {
          a.vx += velAlongNormal * nx;
          a.vy += velAlongNormal * ny;
          b.vx -= velAlongNormal * nx;
          b.vy -= velAlongNormal * ny;
        }
        a.vx -= nx * 70;
        a.vy -= ny * 70;
        b.vx += nx * 70;
        b.vy += ny * 70;
      } else {
        // Super armor during Barrage: prevent knockback/interruption when trading hits!
        if (!aBarraging) {
          a.x -= nx * overlap;
          a.y -= ny * overlap;
        } else if (!bBarraging) {
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }
    // During Time Stop (aFrozen || bFrozen), neither target nor caster is pushed/knocked back!

    // Rule 4: The one who rams/hits the other DEALS 5 DMG to the target!
    if (state.collisionDamageCooldown <= 0) {
      state.collisionDamageCooldown = 0.45;
      spawnParticles((a.x + b.x) / 2, (a.y + b.y) / 2, "#ffffff", 10, 200);
      state.screenShake = Math.max(state.screenShake, 4);

      if (!aFrozen && bFrozen) {
        applyAttackDamage("p1", b, 5, "#fb7185");
      } else if (aFrozen && !bFrozen) {
        applyAttackDamage("p2", a, 5, "#fb7185");
      } else if (aApproach >= bApproach) {
        applyAttackDamage("p1", b, 5, "#fb7185");
      } else {
        applyAttackDamage("p2", a, 5, "#fb7185");
      }
    }
  }
}

function updateBarrageQueue(fighter, opponent, dt) {
  const q = fighter.barrageQueue;
  if (!q || isFrozen(fighter.slot)) return;

  q.timer -= dt;
  while (fighter.barrageQueue && fighter.barrageQueue.timer <= 0) {
    const isLast = fighter.barrageQueue.remaining === 1;
    spawnBarragePunch(fighter, opponent, isLast, fighter.barrageQueue.cfg);
    fighter.barrageQueue.remaining -= 1;
    if (fighter.barrageQueue.remaining <= 0) {
      fadeOutAndStopAudio(fighter.barrageQueue.audioEntry, 180);
      fighter.barrageQueue = null;
    } else {
      fighter.barrageQueue.timer += fighter.barrageQueue.interval;
    }
  }
}

function spawnBarrageClash(x, y, angle) {
  // Avoid stacking too many clash objects at the exact same spot
  const existing = state.barrageClashes.find((c) => Math.hypot(c.x - x, c.y - y) < 42 && c.life > 0.14);
  if (existing) return;

  state.barrageClashes.push({
    x,
    y,
    angle,
    life: 0.22,
    maxLife: 0.22,
    seed: Math.random() * Math.PI * 2,
  });
  spawnParticles(x, y, "#fde047", 5, 220);
  spawnParticles(x, y, "#ffffff", 4, 260);
  state.screenShake = Math.max(state.screenShake, 3.2);
}

function updatePunches(dt) {
  for (let i = state.punches.length - 1; i >= 0; i--) {
    const p = state.punches[i];
    if (isFrozen(p.ownerSlot) || p.suspended) continue;

    if (p.hit) {
      p.life -= dt;
      if (p.life <= 0) state.punches.splice(i, 1);
      continue;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    // Check Barrage-vs-Barrage clash with opposing punches (fast AABB + squared distance)
    if (!p.hit) {
      for (let j = i - 1; j >= 0; j--) {
        const other = state.punches[j];
        if (other.hit || other.suspended || other.ownerSlot === p.ownerSlot) continue;
        const cdx = p.x - other.x;
        if (cdx > 52 || cdx < -52) continue;
        const cdy = p.y - other.y;
        if (cdy > 52 || cdy < -52) continue;
        if (cdx * cdx + cdy * cdy <= 2704) {
          spawnBarrageClash((p.x + other.x) * 0.5, (p.y + other.y) * 0.5, p.angle);
          break;
        }
      }
    }

    const target = getOpponent(p.ownerSlot);
    const isTimeStopActiveForCaster =
      state.timeStop.active && state.timeStop.casterSlot === p.ownerSlot;

    if (!p.hit && !target.hidden) {
      const dx = p.x - target.x;
      const dy = p.y - target.y;
      const distSq = dx * dx + dy * dy;

      if (isTimeStopActiveForCaster) {
        const suspR = target.radius + 48;
        if (distSq <= suspR * suspR) {
          p.suspended = true;
          p.vx = 0;
          p.vy = 0;
          p.angle = Math.atan2(target.y - p.y, target.x - p.x);
          continue;
        }
      } else {
        const hitR = target.radius + 34;
        if (distSq <= hitR * hitR) {
          p.hit = true;
          p.life = Math.max(p.life, 0.09);
          if (!p.isVisualOnly && p.damage > 0) {
            applyAttackDamage(p.ownerSlot, target, p.damage, p.color, false);
            spawnParticles(p.x, p.y, p.color, 2, 110);
            const attacker = getFighter(p.ownerSlot);
            if (attacker?.barrageQueue && !target.barrageQueue) {
              target.barrageStunSlot = p.ownerSlot;
              target.isGuarding = false;
              target.dashTimer = 0;
              target.knockbackTimer = 0;
              target.vx = 0;
              target.vy = 0;
            }
          }
        }
      }
    }

    const travelDist = Math.hypot(p.x - p.originX, p.y - p.originY);
    if (p.life <= 0 || (!p.hit && travelDist > 125)) {
      state.punches.splice(i, 1);
    }
  }
}

function updateStarFinger(dt) {
  for (let i = state.starFingerBeams.length - 1; i >= 0; i--) {
    const beam = state.starFingerBeams[i];
    if (isFrozen(beam.casterSlot)) continue;

    const caster = getFighter(beam.casterSlot);
    beam.x1 = caster.x;
    beam.y1 = caster.y;

    beam.life -= dt;
    const progress = 1 - beam.life / beam.maxLife;
    // Extend rapidly (0..0.45), hold briefly (0.45..0.65), retract back (0.65..1.0)
    if (progress < 0.45) {
      const t = progress / 0.45;
      beam.length = 30 + (beam.maxLength - 30) * (1 - Math.pow(1 - t, 2));
    } else if (progress < 0.65) {
      beam.length = beam.maxLength;
    } else {
      const t = (progress - 0.65) / 0.35;
      beam.length = Math.max(24, beam.maxLength * (1 - t));
    }

    const target = getOpponent(beam.casterSlot);
    if (!beam.hitDone && !target.hidden) {
      const endX = beam.x1 + Math.cos(beam.angle) * beam.length;
      const endY = beam.y1 + Math.sin(beam.angle) * beam.length;
      const dist = pointToSegmentDist(target.x, target.y, beam.x1, beam.y1, endX, endY);
      if (dist <= target.radius + 16) {
        beam.hitDone = true;
        const stunDur = beam.stunDuration || 0.5;
        target.stunTimer = Math.max(target.stunTimer, stunDur);
        applyAttackDamage(beam.casterSlot, target, beam.damage || 15, "#d8b4fe", false);
        spawnParticles(target.x, target.y, "#c084fc", 16, 230);
        spawnFloatingText(target.x, target.y - target.radius - 34, "CHOÁNG!", "#fde047", 19);
        state.screenShake = Math.max(state.screenShake, 6);
      }
    }

    if (beam.life <= 0) {
      state.starFingerBeams.splice(i, 1);
    }
  }
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function applyRadialKnockback(target, originX, originY, speed = 780, duration = 0.34) {
  if (target.sealedTimer > 0) return; // Angelo Stone cannot be knocked back!
  const dx = target.x - originX;
  const dy = target.y - originY;
  const dist = Math.hypot(dx, dy);
  let nx;
  let ny;
  if (dist < 6) {
    const fallbackAngle = Math.atan2(ARENA_CY - target.y, ARENA_CX - target.x);
    nx = Math.cos(fallbackAngle);
    ny = Math.sin(fallbackAngle);
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }

  if (state.timeStop.active && isFrozen(target.slot)) {
    target.timeStopPendingKnockback = {
      vx: nx * speed,
      vy: ny * speed,
      nx,
      ny,
      timer: duration,
    };
    return;
  }

  target.x = Math.max(ARENA_LEFT + target.radius, Math.min(ARENA_RIGHT - target.radius, target.x + nx * 28));
  target.y = Math.max(ARENA_TOP + target.radius, Math.min(ARENA_BOTTOM - target.radius, target.y + ny * 28));
  target.vx = nx * speed;
  target.vy = ny * speed;
  target.dashTimer = 0;
  target.knockbackTimer = duration;
  target.isGuarding = false;
  spawnParticles(target.x, target.y, "#facc15", 14, 280);
  spawnFloatingText(target.x, target.y - target.radius - 30, "ĐÁNH BAY!", "#facc15", 22);
}

function updateRoadRoller(dt) {
  const rr = state.roadRoller;
  if (!rr.active) return;

  const caster = getFighter(rr.casterSlot);
  rr.safetyTimer = (rr.safetyTimer || 0) + dt;
  if (rr.safetyTimer > 4.0) {
    rr.active = false;
    rr.phase = "none";
    rr.safetyTimer = 0;
    caster.hidden = false;
    return;
  }

  if (isFrozen(rr.casterSlot)) return;

  rr.timer -= dt;
  if (rr.phase === "aim") {
    const target = getOpponent(rr.casterSlot);
    if (rr.timer > 0.38 && !isFrozen(target.slot)) {
      rr.targetX += (target.x - rr.targetX) * Math.min(1, dt * 5);
      rr.targetY += (target.y - rr.targetY) * Math.min(1, dt * 5);
    }
    if (rr.timer <= 0) {
      rr.phase = "drop";
      rr.timer = 0.28;
      rr.dropY = rr.targetY - 400;
    }
  } else if (rr.phase === "drop") {
    const t = 1 - rr.timer / 0.28;
    rr.dropY = rr.targetY - 400 * (1 - t * t);
    if (rr.timer <= 0) {
      rr.phase = "impact";
      rr.timer = 0.65;
      rr.dropY = rr.targetY;
      spawnBombExplosion(rr.targetX, rr.targetY, rr.impactRadius, "orange", 13);

      // Hit and knock back ALL enemies within Road Roller AoE radius
      for (const fighter of [state.p1, state.p2, ...state.polnareffClones]) {
        if (fighter.slot === rr.casterSlot || fighter.ownerSlot === rr.casterSlot || fighter.hidden) continue;
        const dist = Math.hypot(fighter.x - rr.targetX, fighter.y - rr.targetY);
        if (dist <= rr.impactRadius + fighter.radius * 0.5) {
          applyAttackDamage(rr.casterSlot, fighter, rr.damage || 40, "#facc15", true);
          applyRadialKnockback(fighter, rr.targetX, rr.targetY, 780, 0.34);
        }
      }
    }
  } else if (rr.phase === "impact") {
    if (rr.timer <= 0) {
      rr.active = false;
      rr.phase = "none";
      caster.hidden = false;
      caster.x = Math.max(ARENA_LEFT + caster.radius, Math.min(ARENA_RIGHT - caster.radius, rr.targetX));
      caster.y = Math.max(ARENA_TOP + caster.radius, Math.min(ARENA_BOTTOM - caster.radius, rr.targetY));
    }
  }
}

function updateFirstBombs(dt) {
  for (let i = state.firstBombs.length - 1; i >= 0; i--) {
    const b = state.firstBombs[i];
    b.life -= dt;
    if (b.armTimer > 0) {
      b.armTimer = Math.max(0, b.armTimer - dt);
    }
    if (b.attachedSlot) {
      const t = getFighter(b.attachedSlot);
      if (t && !t.hidden) {
        b.x = t.x;
        b.y = t.y;
      } else {
        b.attachedSlot = null;
      }
    }
    if (b.life <= 0) {
      state.firstBombs.splice(i, 1);
    }
  }

  for (let i = state.pendingOhkos.length - 1; i >= 0; i--) {
    const p = state.pendingOhkos[i];
    p.timer -= dt;
    if (p.timer <= 0) {
      state.pendingOhkos.splice(i, 1);
      const target = getFighter(p.targetSlot);
      if (target && !target.hidden) applyDamage(target, target.maxHp, "#ef4444", true);
    }
  }
}

function checkAiReflexes(ai, player, cds, dist) {
  // 1. Instant Star Finger dodge or shield
  for (const beam of state.starFingerBeams) {
    if (beam.casterSlot !== "p1" || beam.hitDone) continue;
    const endX = beam.x1 + Math.cos(beam.angle) * beam.maxLength;
    const endY = beam.y1 + Math.sin(beam.angle) * beam.maxLength;
    const lineDist = pointToSegmentDist(ai.x, ai.y, beam.x1, beam.y1, endX, endY);
    if (lineDist <= ai.radius + 32) {
      if (cds.dash <= 0) {
        const px = -Math.sin(beam.angle);
        const py = Math.cos(beam.angle);
        const side = (ai.x - beam.x1) * px + (ai.y - beam.y1) * py >= 0 ? 1 : -1;
        triggerDash(ai, px * side, py * side);
        return true;
      }
      if (ai.guardPool > 8 && ai.guardBrokenTimer <= 0) {
        state.aiGuardTimer = 0.25;
        return true;
      }
    }
  }

  // 2. Instant Road Roller lock-on dodge (or Time Stop counter-ult)
  if (state.roadRoller.active && state.roadRoller.casterSlot === "p1") {
    const rr = state.roadRoller;
    const rDist = Math.hypot(ai.x - rr.targetX, ai.y - rr.targetY);
    if (rDist <= rr.impactRadius + ai.radius + 26 && (rr.phase === "drop" || (rr.phase === "aim" && rr.timer <= 0.42))) {
      if (cds.dash <= 0) {
        triggerDash(ai, ai.x - rr.targetX, ai.y - rr.targetY);
        return true;
      }
      if (cds.q <= 0 && !state.timeStop.active && (ai.charId === "dio" || ai.charId === "jotaro")) {
        castSkill("p2", "q");
        return true;
      }
    }
  }

  // 3. Smart Barrage defense: guard briefly then dash out BEFORE shield breaks!
  if (player.barrageQueue && dist < 175) {
    if (ai.guardBrokenTimer <= 0 && ai.guardPool > 7) {
      state.aiGuardTimer = 0.22;
      return true;
    } else if (cds.dash <= 0) {
      triggerDash(ai, ai.x - player.x, ai.y - player.y);
      return true;
    }
  }

  // 5. Smart Kira Bomb detonation (strictly enforces >= 1s armTimer before detonate!)
  if (ai.charId === "kira") {
    const bomb = state.firstBombs.find((b) => b.ownerSlot === "p2");
    if (bomb && bomb.armTimer <= 0) {
      const rCfg = CHAR_CONFIG.kira.skills.r;
      const blastR = rCfg.groundBlastRadius || 160;
      const bDist = Math.hypot(player.x - bomb.x, player.y - bomb.y);
      if (!player.hidden && bDist <= blastR + player.radius * 0.8) {
        detonateFirstBomb("p2");
        return true;
      }
    }
  }

  const projectiles = [];
  for (const rock of state.josukeRocks) {
    if (rock.casterSlot === "p1" && rock.phase === "out") {
      projectiles.push({
        x: rock.x,
        y: rock.y,
        vx: Math.cos(rock.angle) * rock.speed,
        vy: Math.sin(rock.angle) * rock.speed,
      });
    }
  }
  for (const punch of state.angeloPunches) {
    if (punch.casterSlot === "p1" && !punch.hit) {
      projectiles.push({
        x: punch.x,
        y: punch.y,
        vx: Math.cos(punch.angle) * punch.speed,
        vy: Math.sin(punch.angle) * punch.speed,
      });
    }
  }
  for (const sword of state.swordProjectiles) {
    if (sword.casterSlot === "p1" && !sword.isVisualOnly) {
      projectiles.push({ x: sword.x, y: sword.y, vx: sword.vx, vy: sword.vy });
    }
  }
  for (const punch of state.punches) {
    if (punch.ownerSlot === "p1" && !punch.hit && !punch.suspended) {
      projectiles.push({ x: punch.x, y: punch.y, vx: punch.vx, vy: punch.vy });
    }
  }

  for (const projectile of projectiles) {
    const endX = projectile.x + projectile.vx * 0.18;
    const endY = projectile.y + projectile.vy * 0.18;
    if (pointToSegmentDist(ai.x, ai.y, projectile.x, projectile.y, endX, endY) > ai.radius + 32) continue;
    if (cds.dash <= 0) {
      triggerDash(ai, -projectile.vy, projectile.vx);
      return true;
    }
    if (ai.guardPool > 2 && ai.guardBrokenTimer <= 0) {
      state.aiGuardTimer = 0.24;
      return true;
    }
  }

  for (const finger of state.stringFingers) {
    if (finger.casterSlot !== "p1" || finger.hitDone) continue;
    const endX = finger.x1 + Math.cos(finger.angle) * finger.length;
    const endY = finger.y1 + Math.sin(finger.angle) * finger.length;
    if (pointToSegmentDist(ai.x, ai.y, finger.x1, finger.y1, endX, endY) > ai.radius + 16) continue;
    if (cds.dash <= 0) {
      triggerDash(ai, -Math.sin(finger.angle), Math.cos(finger.angle));
      return true;
    }
    if (ai.guardPool > 2 && ai.guardBrokenTimer <= 0) {
      state.aiGuardTimer = 0.24;
      return true;
    }
  }

  for (const web of state.mobiusWebs) {
    if (web.casterSlot !== "p1" || web.triggered) continue;
    if (Math.hypot(ai.x - web.targetX, ai.y - web.targetY) > web.radius + ai.radius * 0.45 + 24) continue;
    if (cds.dash <= 0) {
      triggerDash(ai, ai.x - web.x, ai.y - web.y);
      return true;
    }
  }

  if (
    player.charId === "okuyasu" &&
    state.theHandQueue.some((swipe) => swipe.casterSlot === "p1") &&
    dist <= CHAR_CONFIG.okuyasu.skills.q.range + ai.radius &&
    cds.dash <= 0
  ) {
    triggerDash(ai, ai.x - player.x, ai.y - player.y);
    return true;
  }

  return false;
}

function runAiCombo(ai, player, cds, dist, dt) {
  const combo = state.aiCombo;
  if (!combo) return false;

  combo.timer -= dt;
  if (combo.timer > 0) return true;

  const step = combo.steps[combo.index];
  if (!step) {
    state.aiCombo = null;
    return false;
  }

  // Execute current combo step
  if (step.type === "dash_in") {
    if (cds.dash <= 0 && dist > (step.minDist || 80)) {
      const lead = step.lead || 0.16;
      triggerDash(ai, player.x + player.vx * lead - ai.x, player.y + player.vy * lead - ai.y);
    }
  } else if (step.type === "skill") {
    if (cds[step.key] <= 0 && (!step.maxDist || dist <= step.maxDist)) {
      castSkill("p2", step.key);
    }
  } else if (step.type === "detonate") {
    const bomb = state.firstBombs.find((b) => b.ownerSlot === "p2");
    if (bomb) {
      const bDist = Math.hypot(player.x - bomb.x, player.y - bomb.y);
      const blastR = CHAR_CONFIG.kira.skills.r.groundBlastRadius || 160;
      if (bomb.attachedSlot === "p1" || (!player.hidden && bDist <= blastR + player.radius * (step.wideRadius ? 0.8 : 0.5))) {
        detonateFirstBomb("p2");
      }
    }
  }

  combo.index += 1;
  if (combo.index >= combo.steps.length) {
    state.aiCombo = null;
  } else {
    combo.timer = combo.steps[combo.index].delay || 0.12;
  }
  return true;
}

function tryStartSuperAiCombo(ai, player, cds, dist) {
  if (state.aiCombo) return false;

  if (ai.charId === "dio") {
    // DIO Combo 1: Time Stop Apocalypse -> Hold Q 1s -> Dash in -> E MUDA Barrage -> R ROAD ROLLER inside 6s TS!
    if (cds.q <= 0 && cds.e <= 0 && !state.timeStop.active && dist < 355) {
      const steps = [];
      if (dist > 215 && cds.dash <= 0) steps.push({ type: "dash_in", delay: 0, lead: 0.14, minDist: 100 });
      steps.push({ type: "skill", key: "q", delay: 0.08 });
      steps.push({ type: "dash_in", delay: 1.08, lead: 0.0, minDist: 95 });
      steps.push({ type: "skill", key: "e", delay: 0.15, maxDist: 175 });
      steps.push({ type: "skill", key: "r", delay: 2.35, maxDist: 280 });
      state.aiCombo = { steps, index: 0, timer: 0 };
      return true;
    }
    // DIO Combo 2: Blitz Dash -> E Barrage -> R Road Roller punish
    if (cds.q > 4 && cds.e <= 0 && cds.dash <= 0 && dist >= 155 && dist <= 330 && !player.barrageQueue) {
      const steps = [
        { type: "dash_in", delay: 0, lead: 0.18, minDist: 95 },
        { type: "skill", key: "e", delay: 0.15, maxDist: 170 },
      ];
      if (cds.r <= 0 && !state.timeStop.active) {
        steps.push({ type: "skill", key: "r", delay: 2.25, maxDist: 380 });
      }
      state.aiCombo = { steps, index: 0, timer: 0 };
      return true;
    }
  } else if (ai.charId === "jotaro") {
    // Jotaro Combo 1: Za Warudo (1s hold) -> Dash -> R ORA Barrage (8s CD!) -> E Star Finger
    if (cds.q <= 0 && cds.r <= 0 && !state.timeStop.active && dist < 345) {
      const steps = [];
      if (dist > 205 && cds.dash <= 0) steps.push({ type: "dash_in", delay: 0, lead: 0.14, minDist: 95 });
      steps.push({ type: "skill", key: "q", delay: 0.08 });
      steps.push({ type: "dash_in", delay: 1.08, lead: 0.0, minDist: 95 });
      steps.push({ type: "skill", key: "r", delay: 0.15, maxDist: 175 });
      steps.push({ type: "skill", key: "e", delay: 2.35, maxDist: 235 });
      state.aiCombo = { steps, index: 0, timer: 0 };
      return true;
    }
    // Jotaro Combo 2: E Star Finger poke -> Dash in -> R ORA Barrage!
    if (cds.e <= 0 && cds.r <= 0 && dist >= 95 && dist <= 232 && !state.timeStop.active) {
      state.aiCombo = {
        steps: [
          { type: "skill", key: "e", delay: 0 },
          { type: "dash_in", delay: 0.16, lead: 0.16, minDist: 95 },
          { type: "skill", key: "r", delay: 0.16, maxDist: 175 },
        ],
        index: 0,
        timer: 0,
      };
      return true;
    }
  } else if (ai.charId === "kira") {
    // Kira Combo 1: plant a trap, pursue and pressure, then detonate after the fuse arms.
    const existingBomb = state.firstBombs.find((b) => b.ownerSlot === "p2");
    if (!existingBomb && cds.r <= 0 && dist >= 100 && dist <= 245 && !player.barrageQueue && !player.hidden) {
      const steps = [
        { type: "skill", key: "r", delay: 0, maxDist: 255 },
      ];
      if (cds.e <= 0 && dist <= 165) {
        steps.push({ type: "skill", key: "e", delay: 0.16, maxDist: 170 });
      } else if (cds.dash <= 0 && dist > 165) {
        steps.push({ type: "dash_in", delay: 0.16, lead: 0.15, minDist: 115 });
        if (cds.e <= 0) {
          steps.push({ type: "skill", key: "e", delay: 0.18, maxDist: 170 });
        }
      }
      steps.push({ type: "detonate", delay: 1.05, wideRadius: true });
      state.aiCombo = { steps, index: 0, timer: 0 };
      return true;
    }
    // Kira Combo 2: Killer Barrage -> Bite The Dust sustain & explosion!
    if (cds.e <= 0 && cds.q <= 0 && ai.hp <= ai.maxHp * 0.72 && dist < 165) {
      state.aiCombo = {
        steps: [
          { type: "skill", key: "e", delay: 0, maxDist: 170 },
          { type: "skill", key: "q", delay: 2.25, maxDist: 295 },
        ],
        index: 0,
        timer: 0,
      };
      return true;
    }
  }

  return false;
}

function tryStartNewCharacterAiCombo(ai, player, cds, dist) {
  if (state.aiCombo || state.timeStop.active) return false;

  if (ai.charId === "diavolo" && cds.e <= 0 && cds.r <= 0 && dist >= 150 && dist <= 350) {
    state.aiCombo = {
      steps: [
        { type: "skill", key: "e", delay: 0 },
        { type: "skill", key: "r", delay: 0.22, maxDist: 205 },
      ],
      index: 0,
      timer: 0,
    };
  } else if (ai.charId === "okuyasu" && cds.e <= 0 && cds.r <= 0 && dist > 120 && dist <= 230) {
    const steps = [{ type: "skill", key: "e", delay: 0 }];
    if (cds.q <= 0) steps.push({ type: "skill", key: "q", delay: 0.16, maxDist: 210 });
    steps.push({ type: "skill", key: "r", delay: 0.18, maxDist: 180 });
    state.aiCombo = { steps, index: 0, timer: 0 };
  } else if (ai.charId === "josuke" && cds.r <= 0 && cds.q <= 0 && dist <= 310) {
    state.aiCombo = {
      steps: [
        { type: "skill", key: "r", delay: 0 },
        { type: "skill", key: "q", delay: 0.3, maxDist: 285 },
      ],
      index: 0,
      timer: 0,
    };
  } else if (ai.charId === "polnareff" && cds.q <= 0 && cds.e <= 0 && dist <= 350) {
    const steps = [{ type: "skill", key: "q", delay: 0 }];
    if (dist > 180 && cds.dash <= 0) {
      steps.push({ type: "dash_in", delay: 0.25, lead: 0.12, minDist: 150 });
    }
    steps.push({ type: "skill", key: "e", delay: 0.2, maxDist: 190 });
    state.aiCombo = { steps, index: 0, timer: 0 };
  } else if (ai.charId === "jolyne" && cds.r <= 0 && cds.e <= 0 && dist >= 120 && dist <= 255) {
    state.aiCombo = {
      steps: [
        { type: "skill", key: "r", delay: 0 },
        { type: "skill", key: "e", delay: 0.18, maxDist: 185 },
      ],
      index: 0,
      timer: 0,
    };
  }

  return Boolean(state.aiCombo);
}

function tryStartAiCombo(ai, player, cds, dist, diff) {
  if (state.aiCombo) return false;
  if (diff.id === "super" && tryStartSuperAiCombo(ai, player, cds, dist)) return true;
  if (Math.random() > diff.comboChance) return false;
  return tryStartNewCharacterAiCombo(ai, player, cds, dist);
}

function updateAI(dt) {
  const ai = state.p2;
  const player = chooseAiTarget(dt);
  const cds = state.cooldowns.p2;
  const barrageStunner = getActiveBarrageStunner(ai);
  if (
    ai.hidden ||
    isFrozen("p2") ||
    ai.biteTheDustCharge > 0 ||
    (ai.stunTimer > 0 && !barrageStunner) ||
    ai.isChargingTimeStop ||
    ai.barrageQueue?.rooted ||
    state.epitaphCounter?.casterSlot === "p2" ||
    state.mobiusCounter?.casterSlot === "p2"
  ) return;

  if (barrageStunner) {
    const barrageSkill = Object.entries(CHAR_CONFIG[ai.charId].skills).find(([, skill]) => skill.isBarrage);
    if (barrageSkill && cds[barrageSkill[0]] <= 0) {
      castSkill("p2", barrageSkill[0]);
    }
    return;
  }

  if (state.aiGuardTimer > 0) {
    state.aiGuardTimer = Math.max(0, state.aiGuardTimer - dt);
  }
  if (state.aiReflexTimer > 0) {
    state.aiReflexTimer = Math.max(0, state.aiReflexTimer - dt);
  }

  if (ai.charId === "dio" && !ai.hidden) {
    state.dioTauntTimer -= dt;
    if (state.dioTauntTimer <= 0) {
      state.dioTauntTimer = 10 + Math.random() * 5;
      playSound(Math.random() < 0.5 ? "dioLaugh" : "dioGreatestHigh");
    }
  }

  const diff = getActiveAiDiff();
  const dist = Math.hypot(player.x - ai.x, player.y - ai.y);

  if (
    state.aiReflexTimer <= 0 &&
    Math.random() < diff.reflexChance &&
    checkAiReflexes(ai, player, cds, dist)
  ) {
    state.aiReflexTimer = diff.id === "easy" ? 0.75 : diff.id === "medium" ? 0.5 : diff.id === "hard" ? 0.32 : 0.2;
    if (state.roadRoller.active && state.roadRoller.casterSlot === "p1") {
      state.aiCombo = null;
    }
    return;
  }

  if (runAiCombo(ai, player, cds, dist, dt)) return;

  state.aiDecisionTimer -= dt;
  if (state.aiDecisionTimer > 0) return;
  state.aiDecisionTimer = diff.decisionMin + Math.random() * (diff.decisionMax - diff.decisionMin);

  if (tryStartAiCombo(ai, player, cds, dist, diff)) {
    runAiCombo(ai, player, cds, dist, 0);
    return;
  }

  // Reactive Guard when player uses Barrage or Star Finger
  if (
    (player.barrageQueue || state.starFingerBeams.length > 0) &&
    dist < 190 &&
    ai.guardPool > 5 &&
    ai.guardBrokenTimer <= 0 &&
    Math.random() < diff.guardChance
  ) {
    state.aiGuardTimer = diff.id === "easy" ? 0.25 : 0.4;
    return;
  }

  // Dash logic scaled by difficulty
  if (cds.dash <= 0 && Math.random() < diff.dashChance) {
    if (
      state.roadRoller.active &&
      state.roadRoller.casterSlot === "p1" &&
      state.roadRoller.phase === "aim" &&
      diff.id !== "easy"
    ) {
      triggerDash(ai, -(player.y - ai.y), player.x - ai.x);
      return;
    }
    // Super AI uses Dash aggressively during its own Time Stop & to chain OHKO / Barrage combos!
    if (diff.id === "super") {
      if (state.timeStop.active && state.timeStop.casterSlot === "p2" && dist > 110) {
        triggerDash(ai, player.x - ai.x, player.y - ai.y);
        return;
      }
      if (dist > 230 && !player.barrageQueue && (cds.e <= 0 || cds.r <= 0 || cds.q <= 0)) {
        const lx = player.x + player.vx * 0.22 - ai.x;
        const ly = player.y + player.vy * 0.22 - ai.y;
        triggerDash(ai, lx, ly);
        return;
      }
    } else if (dist > 290 && Math.random() < (diff.id === "easy" ? 0.25 : 0.6)) {
      triggerDash(ai, player.x - ai.x, player.y - ai.y);
      return;
    }
  }

  if (Math.random() > diff.skillChance) return;

  // Character-specific offense & combos
  if (ai.charId === "dio") {
    const qRange = diff.id === "super" ? 255 : 230;
    if (cds.q <= 0 && !state.timeStop.active && dist < qRange) {
      castSkill("p2", "q");
      return;
    }
    if (cds.e <= 0 && dist < (diff.id === "super" ? 158 : 145)) {
      castSkill("p2", "e");
      return;
    }
    if (cds.r <= 0) {
      if (diff.id === "super") {
        // Super DIO drops Road Roller during Time Stop or when punishing mid-range!
        const inTsWindow = state.timeStop.active && state.timeStop.casterSlot === "p2" && state.timeStop.remaining <= 2.4 && dist < 260;
        const punishWindow = !state.timeStop.active && (player.barrageQueue || player.biteTheDustCharge > 0 || dist < 340);
        if (inTsWindow || punishWindow) {
          castSkill("p2", "r");
        }
      } else if (!state.timeStop.active) {
        castSkill("p2", "r");
      }
    }
  } else if (ai.charId === "jotaro") {
    const qRange = diff.id === "super" ? 250 : 230;
    if (cds.q <= 0 && !state.timeStop.active && dist < qRange) {
      castSkill("p2", "q");
      return;
    }
    if (cds.r <= 0 && dist < (diff.id === "super" ? 158 : 145)) {
      castSkill("p2", "r");
      return;
    }
    const maxFingerRange = diff.id === "easy" ? 320 : 238;
    if (cds.e <= 0 && dist < maxFingerRange) {
      castSkill("p2", "e");
    }
  } else if (ai.charId === "kira") {
    const bomb = state.firstBombs.find((b) => b.ownerSlot === "p2");
    if (bomb && bomb.armTimer <= 0) {
      const bDist = Math.hypot(player.x - bomb.x, player.y - bomb.y);
      const detRadius = diff.id === "super" ? 195 : 135;
      if (bomb.attachedSlot || bDist <= detRadius + player.radius * 0.4) {
        detonateFirstBomb("p2");
        return;
      }
      if (diff.id === "super" && cds.dash <= 0 && dist > 115 && dist < 260) {
        const fromBombX = player.x - bomb.x;
        const fromBombY = player.y - bomb.y;
        const fromBombDist = Math.hypot(fromBombX, fromBombY) || 1;
        const pushDirX = fromBombX / fromBombDist;
        const pushDirY = fromBombY / fromBombDist;
        triggerDash(
          ai,
          player.x + pushDirX * 54 - ai.x,
          player.y + pushDirY * 54 - ai.y
        );
        return;
      }
    }
    if (!bomb && cds.r <= 0 && dist >= 100 && dist <= 235) {
      castSkill("p2", "r");
      return;
    }
    if (cds.q <= 0 && ai.hp <= ai.maxHp * (diff.id === "super" ? 0.68 : 0.55) && dist < 290) {
      castSkill("p2", "q");
      return;
    }
    if (cds.e <= 0 && dist < (diff.id === "super" ? 158 : 145)) {
      castSkill("p2", "e");
    }
  } else if (ai.charId === "diavolo") {
    if (cds.q <= 0 && dist < 240 && (player.barrageQueue || dist < 170)) {
      castSkill("p2", "q");
      return;
    }
    if (cds.e <= 0 && dist > 185 && dist < 350) {
      castSkill("p2", "e");
      return;
    }
    if (cds.r <= 0 && dist < 155) {
      castSkill("p2", "r");
    }
  } else if (ai.charId === "okuyasu") {
    if (cds.q <= 0 && dist < 200) {
      castSkill("p2", "q");
      return;
    }
    if (cds.e <= 0 && dist > 120 && dist < 230) {
      castSkill("p2", "e");
      return;
    }
    if (cds.r <= 0 && dist < 155) {
      castSkill("p2", "r");
    }
  } else if (ai.charId === "josuke") {
    if (cds.q <= 0 && dist < 240) {
      castSkill("p2", "q");
      return;
    }
    if (cds.r <= 0 && dist > 125 && dist < 320) {
      castSkill("p2", "r");
      return;
    }
    if (cds.e <= 0 && dist < 155) {
      castSkill("p2", "e");
    }
  } else if (ai.charId === "polnareff") {
    if (cds.q <= 0 && dist < 320) {
      castSkill("p2", "q");
      return;
    }
    if (cds.r <= 0 && dist > 130 && dist < 440) {
      castSkill("p2", "r");
      return;
    }
    if (cds.e <= 0 && dist < 155) {
      castSkill("p2", "e");
    }
  } else if (ai.charId === "jolyne") {
    if (cds.q <= 0 && dist < 260) {
      castSkill("p2", "q");
      return;
    }
    if (cds.r <= 0 && dist > 120 && dist < 255) {
      castSkill("p2", "r");
      return;
    }
    if (cds.e <= 0 && dist < 155) {
      castSkill("p2", "e");
    }
  }
}

function updateNewCharacterSkills(dt) {
  for (let i = state.dashAfterimages.length - 1; i >= 0; i--) {
    const afterimage = state.dashAfterimages[i];
    afterimage.life -= dt;
    if (afterimage.life <= 0) state.dashAfterimages.splice(i, 1);
  }

  for (let i = state.diavoloTimeSkipZones.length - 1; i >= 0; i--) {
    const zone = state.diavoloTimeSkipZones[i];
    if (isFrozen(zone.casterSlot)) continue;
    zone.life -= dt;
    if (zone.life <= 0) state.diavoloTimeSkipZones.splice(i, 1);
  }
  for (let i = state.diavoloImpales.length - 1; i >= 0; i--) {
    const impale = state.diavoloImpales[i];
    if (isFrozen(impale.casterSlot) || isFrozen(impale.targetSlot)) continue;
    const target = getFighter(impale.targetSlot);
    if (!target || target.hidden) {
      state.diavoloImpales.splice(i, 1);
      continue;
    }

    impale.armTimer = Math.max(0, impale.armTimer - dt);
    if (impale.phase === "strike") {
      impale.timer -= dt;
      target.vx = 0;
      target.vy = 0;
      target.dashTimer = 0;
      target.knockbackTimer = 0;
      target.stunTimer = Math.max(target.stunTimer, Math.max(0, impale.timer));
      if (impale.timer <= 0) {
        impale.phase = "flight";
        const distanceToWall = Math.abs(impale.wallX - target.x);
        target.vx = impale.facing * impale.flightSpeed;
        target.knockbackTimer = Math.max(0.35, distanceToWall / impale.flightSpeed + 0.2);
      }
    } else if (impale.phase === "flight") {
      const reachedWall =
        impale.facing > 0 ? target.x >= impale.wallX - 1 : target.x <= impale.wallX + 1;
      if (reachedWall) {
        target.x = impale.wallX;
        impale.phase = "pin";
        impale.timer = impale.pinDuration;
        target.vx = 0;
        target.vy = 0;
        target.knockbackTimer = 0;
        target.stunTimer = Math.max(target.stunTimer, impale.pinDuration);
        spawnParticles(target.x, target.y, "#ef4444", 18, 250);
        spawnFloatingText(target.x, target.y - target.radius - 24, "GHIM TƯỜNG!", "#f87171", 20);
      } else {
        target.vx = impale.facing * impale.flightSpeed;
        target.vy = 0;
        target.dashTimer = 0;
        target.knockbackTimer = Math.max(
          target.knockbackTimer,
          Math.abs(impale.wallX - target.x) / impale.flightSpeed + 0.2
        );
      }
    } else {
      impale.timer -= dt;
      target.x = impale.wallX;
      target.vx = 0;
      target.vy = 0;
      target.knockbackTimer = 0;
      target.stunTimer = Math.max(target.stunTimer, Math.max(0, impale.timer));
      if (impale.timer <= 0) state.diavoloImpales.splice(i, 1);
    }
  }

  // 1. The Hand erase VFX & 3-swipe Space Erase queue
  for (let i = state.eraseSwipes.length - 1; i >= 0; i--) {
    state.eraseSwipes[i].life -= dt;
    if (state.eraseSwipes[i].life <= 0) state.eraseSwipes.splice(i, 1);
  }
  for (let i = state.theHandQueue.length - 1; i >= 0; i--) {
    const item = state.theHandQueue[i];
    if (isFrozen(item.casterSlot)) continue;
    item.delay -= dt;
    if (item.delay <= 0) {
      state.theHandQueue.splice(i, 1);
      const caster = getFighter(item.casterSlot);
      const opp = getOpponent(item.casterSlot);
      const angle = Math.atan2(opp.y - caster.y, opp.x - caster.x);
      spawnTheHandSwipeVfx(caster, angle);
      playSound(item.soundKey, item.isLast ? 1.9 : 1.0);
      const dist = Math.hypot(opp.x - caster.x, opp.y - caster.y);
      if (!opp.hidden && dist <= item.range + opp.radius) {
        opp.stunTimer = Math.max(opp.stunTimer, item.stunDuration);
        applyAttackDamage(item.casterSlot, opp, item.damage, "#38bdf8", item.isLast);
        spawnParticles(opp.x, opp.y, "#38bdf8", 14, 240);
      }
    }
  }

  // 2. Josuke ground cracks, Rock Return & Angelo Stone punch
  for (let i = state.groundCracks.length - 1; i >= 0; i--) {
    state.groundCracks[i].life -= dt;
    if (state.groundCracks[i].life <= 0) state.groundCracks.splice(i, 1);
  }
  for (let i = state.josukeRocks.length - 1; i >= 0; i--) {
    const rock = state.josukeRocks[i];
    if (isFrozen(rock.casterSlot)) continue;
    const caster = getFighter(rock.casterSlot);
    const opp = getOpponent(rock.casterSlot);

    if (rock.phase === "out") {
      rock.x += Math.cos(rock.angle) * rock.speed * dt;
      rock.y += Math.sin(rock.angle) * rock.speed * dt;
      if (!rock.hit && !opp.hidden && Math.hypot(opp.x - rock.x, opp.y - rock.y) <= rock.radius + opp.radius) {
        rock.hit = true;
        rock.targetSlot = opp.slot;
        applyAttackDamage(rock.casterSlot, opp, rock.damage, "#f472b6", false);
        applyRadialKnockback(opp, rock.originX, rock.originY, 460, 0.32);
        spawnParticles(opp.x, opp.y, "#f472b6", 16, 220);
        spawnFloatingText(opp.x, opp.y - 70, "ĐẨY LÙI!", "#f472b6", 20);
      }

      if (Math.hypot(rock.x - rock.originX, rock.y - rock.originY) >= rock.maxRange) {
        if (rock.hit) {
          rock.phase = "return";
          spawnFloatingText(rock.x, rock.y - 42, "TẢNG ĐÁ QUAY VỀ!", "#f472b6", 17);
        } else {
          state.josukeRocks.splice(i, 1);
        }
      }
    } else if (rock.phase === "return") {
      const toCasterX = caster.x - rock.x;
      const toCasterY = caster.y - rock.y;
      const toCasterDist = Math.hypot(toCasterX, toCasterY) || 1;
      const returnStep = Math.min(toCasterDist, 520 * dt);
      rock.x += (toCasterX / toCasterDist) * returnStep;
      rock.y += (toCasterY / toCasterDist) * returnStep;

      const target = getFighter(rock.targetSlot);
      if (
        target &&
        target.knockbackTimer <= 0 &&
        target.dashTimer <= 0 &&
        target.sealedTimer <= 0 &&
        !target.hidden
      ) {
        const pullX = rock.x - target.x;
        const pullY = rock.y - target.y;
        const pullDist = Math.hypot(pullX, pullY) || 1;
        const pullStep = Math.min(pullDist, 620 * dt);
        target.x = clampArenaX(target.x + (pullX / pullDist) * pullStep, target.radius);
        target.y = clampArenaY(target.y + (pullY / pullDist) * pullStep, target.radius);
      }

      if (toCasterDist <= caster.radius + 32) {
        state.josukeRocks.splice(i, 1);
      }
    }
  }
  for (let i = state.angeloPunches.length - 1; i >= 0; i--) {
    const ap = state.angeloPunches[i];
    if (isFrozen(ap.casterSlot)) continue;
    const opp = getOpponent(ap.casterSlot);
    ap.x += Math.cos(ap.angle) * ap.speed * dt;
    ap.y += Math.sin(ap.angle) * ap.speed * dt;
    if (!ap.hit && !opp.hidden && Math.hypot(opp.x - ap.x, opp.y - ap.y) <= opp.radius + 32) {
      ap.hit = true;
      playSound(CHAR_CONFIG.josuke.skills.q.soundKey);
      applyAttackDamage(ap.casterSlot, opp, ap.damage, "#f472b6", true);
      opp.sealedTimer = Math.max(opp.sealedTimer, ap.sealDuration);
      opp.knockbackTimer = 0;
      opp.isGuarding = false;
      spawnParticles(opp.x, opp.y, "#cbd5e1", 22, 260);
      spawnFloatingText(opp.x, opp.y - 90, "PHONG ẤN 2s!", "#fde047", 24);
      state.angeloPunches.splice(i, 1);
      continue;
    }
    if (Math.hypot(ap.x - ap.originX, ap.y - ap.originY) >= ap.maxRange) {
      state.angeloPunches.splice(i, 1);
    }
  }

  // 3. Polnareff Sword Projectiles & Armor Off AI Clones
  for (let i = state.swordProjectiles.length - 1; i >= 0; i--) {
    const sw = state.swordProjectiles[i];
    if (isFrozen(sw.casterSlot)) continue;
    sw.x += sw.vx * dt;
    sw.y += sw.vy * dt;
    sw.life -= dt;
    const opp = getOpponent(sw.casterSlot);
    if (!sw.isVisualOnly && !opp.hidden && Math.hypot(opp.x - sw.x, opp.y - sw.y) <= opp.radius + 26) {
      applyAttackDamage(sw.casterSlot, opp, sw.damage, "#e2e8f0", false);
      spawnParticles(sw.x, sw.y, "#e2e8f0", 12, 200);
      state.swordProjectiles.splice(i, 1);
      continue;
    }
    if (sw.life <= 0 || sw.x < ARENA_LEFT - 40 || sw.x > ARENA_RIGHT + 40 || sw.y < ARENA_TOP - 40 || sw.y > ARENA_BOTTOM + 40) {
      state.swordProjectiles.splice(i, 1);
    }
  }
  for (let i = state.polnareffClones.length - 1; i >= 0; i--) {
    const cl = state.polnareffClones[i];
    if (isFrozen(cl.ownerSlot)) continue;
    cl.life -= dt;
    if (cl.hidden || cl.life <= 0) {
      state.polnareffClones.splice(i, 1);
      continue;
    }
    const opp = getOpponent(cl.ownerSlot);
    const owner = getFighter(cl.ownerSlot);
    const sideX = -owner.facing * cl.side * 72;
    let targetX = owner.x - owner.facing * 155 + sideX;
    let targetY = owner.y + cl.side * 90;
    let awayX = targetX - opp.x;
    let awayY = targetY - opp.y;
    let awayDist = Math.hypot(awayX, awayY) || 1;
    if (awayDist < 220) {
      targetX = opp.x + (awayX / awayDist) * 220;
      targetY = opp.y + (awayY / awayDist) * 220;
    }
    targetX = clampArenaX(targetX, cl.radius);
    targetY = clampArenaY(targetY, cl.radius);

    const dx = targetX - cl.x;
    const dy = targetY - cl.y;
    const distance = Math.hypot(dx, dy);
    const ownerSpeedMultiplier =
      owner.armorOffTimer > 0 ? (CHAR_CONFIG.polnareff.skills.q.speedMult || 1.5) : 1;
    const ownerSpeed = (owner.isGuarding ? 165 : 250) * ownerSpeedMultiplier;
    const moveDistance = Math.min(distance, ownerSpeed * 0.6 * dt);
    if (distance > 0) {
      cl.vx = (dx / distance) * ownerSpeed * 0.6;
      cl.vy = (dy / distance) * ownerSpeed * 0.6;
      cl.x = clampArenaX(cl.x + (dx / distance) * moveDistance, cl.radius);
      cl.y = clampArenaY(cl.y + (dy / distance) * moveDistance, cl.radius);
    } else {
      cl.vx = 0;
      cl.vy = 0;
    }
    cl.facing = owner.facing;

    if (cl.barrageQueue) {
      cl.barrageQueue.timer -= dt;
      while (cl.barrageQueue && cl.barrageQueue.timer <= 0) {
        const isLast = cl.barrageQueue.remaining === 1;
        spawnBarragePunch({ ...cl, charId: "polnareff" }, opp, isLast, cl.barrageQueue.cfg);
        cl.barrageQueue.remaining -= 1;
        if (cl.barrageQueue.remaining <= 0) cl.barrageQueue = null;
        else cl.barrageQueue.timer += cl.barrageQueue.interval;
      }
    }
  }

  // 4. Jolyne String Finger & Mobius Spider Web
  for (let i = state.stringFingers.length - 1; i >= 0; i--) {
    const sf = state.stringFingers[i];
    if (isFrozen(sf.casterSlot)) continue;
    const caster = getFighter(sf.casterSlot);
    const opp = getOpponent(sf.casterSlot);
    if (sf.phase === "spin" || sf.phase === "slam") {
      if (!caster || !opp || opp.hidden) {
        state.stringFingers.splice(i, 1);
        continue;
      }
      sf.x1 = caster.x;
      sf.y1 = caster.y;
      sf.phaseTimer = Math.max(0, sf.phaseTimer - dt);
      if (sf.phase === "spin") {
        const progress = 1 - sf.phaseTimer / sf.spinDuration;
        const angle = sf.spinStartAngle + progress * Math.PI * 2;
        opp.x = clampArenaX(caster.x + Math.cos(angle) * sf.orbitRadius, opp.radius);
        opp.y = clampArenaY(caster.y + Math.sin(angle) * sf.orbitRadius, opp.radius);
        if (sf.phaseTimer <= 0) {
          sf.phase = "slam";
          sf.phaseTimer = sf.slamDuration;
          sf.slamStartX = opp.x;
          sf.slamStartY = opp.y;
        }
      } else {
        const progress = 1 - sf.phaseTimer / sf.slamDuration;
        opp.x = clampArenaX(
          sf.slamStartX + (sf.originalX - sf.slamStartX) * progress,
          opp.radius
        );
        opp.y = clampArenaY(
          sf.slamStartY + (sf.originalY - sf.slamStartY) * progress,
          opp.radius
        );
        if (sf.phaseTimer <= 0) {
          opp.x = sf.originalX;
          opp.y = sf.originalY;
          opp.stunTimer = Math.max(opp.stunTimer, 0.5);
          state.groundCracks.push({
            x: opp.x,
            y: opp.y,
            angle: sf.angle,
            life: 0.9,
            maxLife: 0.9,
          });
          spawnParticles(opp.x, opp.y, "#22d3ee", 24, 300);
          spawnParticles(opp.x, opp.y, "#f8fafc", 14, 190);
          spawnFloatingText(opp.x, opp.y - 78, "ĐẬP ĐẤT!", "#22d3ee", 23);
          state.screenShake = Math.max(state.screenShake, 9);
          applyAttackDamage(sf.casterSlot, opp, sf.damage, "#22d3ee", true);
          state.stringFingers.splice(i, 1);
          continue;
        }
      }
      sf.angle = Math.atan2(opp.y - sf.y1, opp.x - sf.x1);
      sf.length = Math.hypot(opp.x - sf.x1, opp.y - sf.y1);
      opp.stunTimer = Math.max(opp.stunTimer, sf.phaseTimer + 0.18);
      opp.barrageStunSlot = null;
      opp.isGuarding = false;
      opp.vx = 0;
      opp.vy = 0;
      opp.dashTimer = 0;
      opp.knockbackTimer = 0;
      continue;
    }
    sf.x1 = caster.x;
    sf.y1 = caster.y;
    sf.life -= dt;
    const progress = 1 - sf.life / sf.maxLife;
    sf.length = progress < 0.5 ? 30 + (sf.maxLength - 30) * (progress / 0.5) : Math.max(24, sf.maxLength * (1 - (progress - 0.5) / 0.5));
    if (!sf.hitDone && !opp.hidden) {
      const endX = sf.x1 + Math.cos(sf.angle) * sf.length;
      const endY = sf.y1 + Math.sin(sf.angle) * sf.length;
      if (pointToSegmentDist(opp.x, opp.y, sf.x1, sf.y1, endX, endY) <= opp.radius + 16) {
        sf.hitDone = true;
        sf.phase = "spin";
        sf.originalX = opp.x;
        sf.originalY = opp.y;
        sf.spinStartAngle = Math.atan2(opp.y - caster.y, opp.x - caster.x);
        sf.orbitRadius = Math.min(130, Math.max(caster.radius + opp.radius + 12, Math.hypot(opp.x - caster.x, opp.y - caster.y) * 0.55));
        sf.spinDuration = 0.9;
        sf.phaseTimer = sf.spinDuration;
        sf.slamDuration = 0.24;
        spawnParticles(opp.x, opp.y, "#22d3ee", 14, 210);
        opp.stunTimer = Math.max(opp.stunTimer, sf.spinDuration + sf.slamDuration + 0.18);
        opp.barrageStunSlot = null;
        opp.isGuarding = false;
        opp.vx = 0;
        opp.vy = 0;
        opp.dashTimer = 0;
        opp.knockbackTimer = 0;
        if (opp.barrageQueue) {
          fadeOutAndStopAudio(opp.barrageQueue.audioEntry);
          opp.barrageQueue = null;
        }
        spawnFloatingText(opp.x, opp.y - 72, "TRÓI TƠ!", "#22d3ee", 20);
      }
    }
    if (sf.phase === "extend" && sf.life <= 0) state.stringFingers.splice(i, 1);
  }
  for (let i = state.mobiusWebs.length - 1; i >= 0; i--) {
    const web = state.mobiusWebs[i];
    if (isFrozen(web.casterSlot)) continue;
    const caster = getFighter(web.casterSlot);
    const opp = getOpponent(web.casterSlot);
    if (!web.landed) {
      const dx = web.targetX - web.x;
      const dy = web.targetY - web.y;
      const d = Math.hypot(dx, dy);
      if (d <= web.speed * dt + 6) {
        web.x = web.targetX;
        web.y = web.targetY;
        web.landed = true;
      } else {
        web.x += (dx / d) * web.speed * dt;
        web.y += (dy / d) * web.speed * dt;
      }
    } else {
      web.life -= dt;
    }

    if (!web.triggered && !opp.hidden && Math.hypot(opp.x - web.x, opp.y - web.y) <= web.radius + opp.radius * 0.45) {
      web.triggered = true;
      web.landed = true;
      web.x = clampArenaX(opp.x, 50);
      web.y = clampArenaY(opp.y, 50);
      web.life = Math.max(web.life, 1.6);
      playSound(CHAR_CONFIG.jolyne.skills.q.soundKey);
      if (opp.sealedTimer <= 0) {
        opp.x = web.x;
        opp.y = web.y;
      }
      caster.x = clampArenaX(
        web.x + (caster.x < web.x ? -1 : 1) * (caster.radius + opp.radius + 8),
        caster.radius
      );
      caster.y = clampArenaY(web.y, caster.radius);
      caster.facing = web.x >= caster.x ? 1 : -1;
      spawnFloatingText(web.x, web.y - 84, "TRÓI CHẶT!", "#22d3ee", 24);
      startMobiusCounter(caster, opp, CHAR_CONFIG.jolyne.skills.q);
    }

    if (web.life <= 0) state.mobiusWebs.splice(i, 1);
  }
}

function update(dt) {
  if (!state || !state.running) return;
  if (isTouchDeviceOrSmallScreen() && window.innerHeight > window.innerWidth) return;

  ensureDesiredBgmPlaying();
  if (!state.roadRoller.active) {
    if (state.p1.hidden) state.p1.hidden = false;
    if (state.p2.hidden) state.p2.hidden = false;
  }

  for (const slot of ["p1", "p2"]) {
    for (const k of ["q", "e", "r", "dash"]) {
      if (state.cooldowns[slot][k] > 0) {
        state.cooldowns[slot][k] = Math.max(0, state.cooldowns[slot][k] - dt);
      }
    }
  }

  if (state.collisionDamageCooldown > 0) {
    state.collisionDamageCooldown = Math.max(0, state.collisionDamageCooldown - dt);
  }
  if (state.p1.hitFlash > 0) state.p1.hitFlash = Math.max(0, state.p1.hitFlash - dt);
  if (state.p2.hitFlash > 0) state.p2.hitFlash = Math.max(0, state.p2.hitFlash - dt);

  if (state.timeStop.active) {
    state.timeStop.remaining -= dt;
    state.timeStop.rippleRadius += dt * 1350;
    timestopTimer.textContent = `${Math.max(0, state.timeStop.remaining).toFixed(1)}s`;
    if (state.timeStop.remaining <= 0) {
      const tsCaster = state.timeStop.casterSlot;
      state.timeStop.active = false;
      timestopBanner.classList.add("hidden");
      releaseSuspendedTimeStopPunches();
      releaseTimeStopDamage(tsCaster);
    }
  }

  updateFighterPhysics(state.p1, dt);
  updateFighterPhysics(state.p2, dt);
  handleFighterCollision();

  updateBarrageQueue(state.p1, state.p2, dt);
  updateBarrageQueue(state.p2, getOpponent("p2"), dt);
  updatePunches(dt);
  updateStarFinger(dt);
  updateRoadRoller(dt);
  updateFirstBombs(dt);
  updateNewCharacterSkills(dt);
  updateAI(dt);
  updateEpitaphCounter(dt);
  updateMobiusCounter(dt);

  for (let i = state.explosions.length - 1; i >= 0; i--) {
    state.explosions[i].life -= dt;
    if (state.explosions[i].life <= 0) state.explosions.splice(i, 1);
  }

  for (let i = state.barrageClashes.length - 1; i >= 0; i--) {
    state.barrageClashes[i].life -= dt;
    if (state.barrageClashes[i].life <= 0) state.barrageClashes.splice(i, 1);
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }

  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.life -= dt;
    if (ft.life <= 0) state.floatingTexts.splice(i, 1);
  }

  if (state.screenShake > 0) {
    state.screenShake = Math.max(0, state.screenShake - dt * 32);
  }

  state.uiSyncTimer -= dt;
  if (state.uiSyncTimer <= 0) {
    state.uiSyncTimer = 0.06; // ~16Hz DOM sync avoids 60fps layout thrashing
    updateHpUI();
    updateSkillBarUI();
  }
}

// ── Rendering ───────────────────────────────────────────────
let _frameNow = 0;

function roundedRectPath(context, x, y, width, height, radius) {
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function draw() {
  _frameNow = performance.now();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scaleX = canvas.width / WORLD_W;
  const scaleY = canvas.height / WORLD_H;
  ctx.save();
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

  if (state && state.screenShake > 0) {
    const sx = (Math.random() - 0.5) * state.screenShake * 2;
    const sy = (Math.random() - 0.5) * state.screenShake * 2;
    ctx.translate(sx, sy);
  }

  drawJoJoArenaFloor();

  if (state && state.timeStop.active) {
    // Fast GPU-friendly monochrome atmosphere overlay (avoids slow software ctx.filter)
    ctx.save();
    ctx.beginPath();
    roundedRectPath(ctx, ARENA_LEFT, ARENA_TOP, ARENA_W, ARENA_H, 22);
    ctx.fillStyle = "rgba(15, 23, 42, 0.36)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(56, 189, 248, 0.55)";
    ctx.stroke();
    ctx.restore();
  }

  if (!state) {
    ctx.restore();
    return;
  }

  for (const zone of state.diavoloTimeSkipZones) {
    drawDiavoloTimeSkipZone(zone);
  }
  for (const crack of state.groundCracks) {
    drawGroundCrack(crack);
  }
  for (const web of state.mobiusWebs) {
    drawMobiusWeb(web);
  }
  for (const bomb of state.firstBombs) {
    drawFirstBomb(bomb);
  }

  if (state.roadRoller.active && state.roadRoller.phase === "aim") {
    drawRoadRollerTarget(state.roadRoller);
  }

  for (const beam of state.starFingerBeams) {
    drawStarFinger(beam);
  }
  for (const sf of state.stringFingers) {
    drawStringFinger(sf);
  }
  for (const cl of state.polnareffClones) {
    drawPolnareffClone(cl);
  }
  for (const afterimage of state.dashAfterimages) {
    drawDashAfterimage(afterimage);
  }

  if (!state.p2.hidden) drawFighter(state.p2);
  if (!state.p1.hidden) drawFighter(state.p1);

  for (const impale of state.diavoloImpales) {
    drawDiavoloImpale(impale);
  }
  for (const rock of state.josukeRocks) {
    drawSpriteProjectile(ASSETS.josukeRock, rock.x, rock.y, 64, rock.angle * 0.2);
  }
  for (const ap of state.angeloPunches) {
    drawSpriteProjectile(CHAR_CONFIG.josuke.armAsset(), ap.x, ap.y, 110, ap.angle);
  }
  for (const sw of state.swordProjectiles) {
    drawSpriteProjectile(ASSETS.polnareffSwordProj, sw.x, sw.y, sw.drawSize || 155, sw.angle);
  }
  for (const swipe of state.eraseSwipes) {
    drawEraseSwipe(swipe);
  }

  for (const p of state.punches) {
    drawPunch(p);
  }
  for (const p of state.epitaphFists) {
    drawPunch(p);
  }
  for (const p of state.mobiusFists) {
    drawPunch(p);
  }

  for (const clash of state.barrageClashes) {
    drawBarrageClash(clash);
  }

  if (
    state.roadRoller.active &&
    (state.roadRoller.phase === "drop" || state.roadRoller.phase === "impact")
  ) {
    drawRoadRollerVehicle(state.roadRoller);
  }

  for (const ex of state.explosions) {
    drawBombExplosion(ex);
  }

  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (state.timeStop.active && state.timeStop.rippleRadius < 1600) {
    const caster = getFighter(state.timeStop.casterSlot);
    ctx.save();
    ctx.strokeStyle = CHAR_CONFIG[caster.charId].color;
    ctx.lineWidth = 6;
    ctx.globalAlpha = Math.max(0, 1 - state.timeStop.rippleRadius / 1600);
    ctx.beginPath();
    ctx.arc(caster.x, caster.y, state.timeStop.rippleRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const ft of state.floatingTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
    ctx.font = `900 ${ft.size}px "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#090414";
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  if (
    state.p1.charId === "diavolo" &&
    (state.p1.epitaphTimer > 0 || state.epitaphCounter?.casterSlot === "p1")
  ) {
    ctx.fillStyle = "rgba(239, 68, 68, 0.10)";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.strokeStyle = "rgba(239, 68, 68, 0.45)";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, WORLD_W - 6, WORLD_H - 6);
  }

  ctx.restore();
}

function buildArenaFloorCache() {
  if (!arenaFloorCache) {
    arenaFloorCache = document.createElement("canvas");
  }
  arenaFloorCache.width = canvas.width;
  arenaFloorCache.height = canvas.height;
  const fctx = arenaFloorCache.getContext("2d");
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.clearRect(0, 0, arenaFloorCache.width, arenaFloorCache.height);
  fctx.setTransform(canvas.width / WORLD_W, 0, 0, canvas.height / WORLD_H, 0, 0);

  const hasMap = Boolean(arenaMapImage?.complete && arenaMapImage.naturalWidth);
  fctx.beginPath();
  roundedRectPath(fctx, ARENA_LEFT, ARENA_TOP, ARENA_W, ARENA_H, 22);
  fctx.save();
  fctx.clip();

  if (hasMap) {
    const scale = Math.max(ARENA_W / arenaMapImage.naturalWidth, ARENA_H / arenaMapImage.naturalHeight);
    const width = arenaMapImage.naturalWidth * scale;
    const height = arenaMapImage.naturalHeight * scale;
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = "high";
    fctx.drawImage(arenaMapImage, ARENA_CX - width / 2, ARENA_CY - height / 2, width, height);
    fctx.fillStyle = "rgba(7, 6, 15, 0.2)";
    fctx.fillRect(ARENA_LEFT, ARENA_TOP, ARENA_W, ARENA_H);
    const mapShade = fctx.createLinearGradient(ARENA_LEFT, 0, ARENA_RIGHT, 0);
    mapShade.addColorStop(0, "rgba(5, 5, 13, 0.28)");
    mapShade.addColorStop(0.5, "rgba(5, 5, 13, 0.03)");
    mapShade.addColorStop(1, "rgba(5, 5, 13, 0.19)");
    fctx.fillStyle = mapShade;
    fctx.fillRect(ARENA_LEFT, ARENA_TOP, ARENA_W, ARENA_H);
  } else {
    const grad = fctx.createRadialGradient(ARENA_CX, ARENA_CY, 90, ARENA_CX, ARENA_CY, ARENA_W * 0.65);
    grad.addColorStop(0, "#3b2621");
    grad.addColorStop(0.6, "#27171a");
    grad.addColorStop(1, "#160b12");
    fctx.fillStyle = grad;
    fctx.fillRect(ARENA_LEFT, ARENA_TOP, ARENA_W, ARENA_H);

    fctx.strokeStyle = "rgba(250, 204, 21, 0.08)";
    fctx.lineWidth = 1.5;
    const tileSize = 78;
    fctx.beginPath();
    for (let x = ARENA_LEFT; x < ARENA_RIGHT; x += tileSize) {
      fctx.moveTo(x, ARENA_TOP);
      fctx.lineTo(x, ARENA_BOTTOM);
    }
    for (let y = ARENA_TOP; y < ARENA_BOTTOM; y += tileSize) {
      fctx.moveTo(ARENA_LEFT, y);
      fctx.lineTo(ARENA_RIGHT, y);
    }
    fctx.stroke();

    fctx.strokeStyle = "rgba(250, 204, 21, 0.14)";
    fctx.lineWidth = 3;
    fctx.beginPath();
    fctx.arc(ARENA_CX, ARENA_CY, 160, 0, Math.PI * 2);
    fctx.stroke();

    fctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 110 : 48;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const px = ARENA_CX + Math.cos(a) * r;
      const py = ARENA_CY + Math.sin(a) * r;
      if (i === 0) fctx.moveTo(px, py);
      else fctx.lineTo(px, py);
    }
    fctx.closePath();
    fctx.fillStyle = "rgba(250, 204, 21, 0.05)";
    fctx.fill();
    fctx.stroke();

    fctx.fillStyle = "rgba(250, 204, 21, 0.07)";
    fctx.font = "900 44px sans-serif";
    fctx.fillText("ゴ", ARENA_LEFT + 32, ARENA_TOP + 64);
    fctx.fillText("ゴ", ARENA_RIGHT - 74, ARENA_BOTTOM - 34);
  }

  fctx.restore();

  fctx.beginPath();
  roundedRectPath(fctx, ARENA_LEFT, ARENA_TOP, ARENA_W, ARENA_H, 22);
  fctx.lineWidth = 6;
  fctx.strokeStyle = "#d97706";
  fctx.stroke();

  fctx.beginPath();
  roundedRectPath(fctx, ARENA_LEFT + 5, ARENA_TOP + 5, ARENA_W - 10, ARENA_H - 10, 18);
  fctx.lineWidth = 2;
  fctx.strokeStyle = "rgba(253, 224, 71, 0.45)";
  fctx.stroke();

  arenaFloorCacheDirty = false;
}

function drawJoJoArenaFloor() {
  if (arenaFloorCacheDirty || !arenaFloorCache || arenaFloorCache.width !== canvas.width || arenaFloorCache.height !== canvas.height) {
    buildArenaFloorCache();
  }
  ctx.drawImage(arenaFloorCache, 0, 0, WORLD_W, WORLD_H);
}

function drawFighter(f) {
  ctx.save();
  ctx.translate(f.x, f.y);

  if (state && f.slot === "p1") {
    ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, f.radius - 4, f.radius * 0.92, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
  ctx.beginPath();
  ctx.ellipse(0, f.radius - 4, f.radius * 0.82, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  if (f.isGuarding) {
    const auraColor = CHAR_CONFIG[f.charId].guardAura;
    ctx.strokeStyle = auraColor;
    ctx.fillStyle = `${auraColor}33`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (f.biteTheDustCharge > 0) {
    const chargeDuration = f.biteTheDustChargeDuration || CHAR_CONFIG.kira.skills.q.chargeTime;
    const pct = 1 - f.biteTheDustCharge / chargeDuration;
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 20, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
  }

  if (f.isChargingTimeStop) {
    const pct = Math.min(1, f.timeStopCharge / (f.timeStopChargeMax || 1.0));
    ctx.strokeStyle = CHAR_CONFIG[f.charId].color;
    ctx.fillStyle = `${CHAR_CONFIG[f.charId].color}22`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 18, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
  }

  if (isFrozen(f.slot)) {
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (f.epitaphTimer > 0) {
    ctx.strokeStyle = "#ef4444";
    ctx.fillStyle = "rgba(239, 68, 68, 0.16)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (f.hitFlash > 0) {
    ctx.fillStyle = "rgba(255, 77, 79, 0.28)";
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Normalize all characters by consistent visual height (+ per-character spriteScale)
  const scale = CHAR_CONFIG[f.charId].spriteScale || 1;
  const targetH = f.radius * 2.35 * scale;
  let activeImg = f.img;
  if (f.sealedTimer > 0) {
    activeImg = ASSETS.josukeAngelo;
  } else if (f.charId === "polnareff" && f.armorOffTimer > 0) {
    activeImg = ASSETS.polnareffArmorOff;
  } else if (f.charId === "jolyne" && f.jolynePoseTimer > 0) {
    activeImg = ASSETS.jolyneSkillQ;
  }
  const sprite = getMipSprite(activeImg, 240);
  if (sprite) {
    const sw = sprite.width || activeImg.naturalWidth;
    const sh = sprite.height || activeImg.naturalHeight;
    const aspect = sw / sh;
    let h = targetH;
    let w = targetH * aspect;
    const maxW = f.radius * 2.85 * scale;
    if (w > maxW) {
      w = maxW;
      h = maxW / aspect;
    }
    ctx.scale(f.facing, 1);
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = CHAR_CONFIG[f.charId].color;
    ctx.beginPath();
    ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Spinning golden stars mark fighters who are stunned, sealed, or barrage-pinned.
  if (f.stunTimer > 0 || f.sealedTimer > 0 || getActiveBarrageStunner(f)) {
    ctx.save();
    ctx.translate(f.x, f.y - f.radius - 26);
    const rot = _frameNow * 0.0085;
    const rx = 24;
    const ry = 8;
    ctx.strokeStyle = "rgba(253, 224, 71, 0.45)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    for (let s = 0; s < 3; s++) {
      const ang = rot + (s * Math.PI * 2) / 3;
      const sx = Math.cos(ang) * rx;
      const sy = Math.sin(ang) * ry;
      const starR = 5.8 + Math.sin(ang) * 1.4;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(rot * 1.3);
      ctx.beginPath();
      for (let p = 0; p < 10; p++) {
        const rad = p % 2 === 0 ? starR : starR * 0.45;
        const pa = (p * Math.PI) / 5 - Math.PI / 2;
        if (p === 0) ctx.moveTo(Math.cos(pa) * rad, Math.sin(pa) * rad);
        else ctx.lineTo(Math.cos(pa) * rad, Math.sin(pa) * rad);
      }
      ctx.closePath();
      ctx.fillStyle = "#fde047";
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawFirstBomb(bomb) {
  ctx.save();
  ctx.translate(bomb.x, bomb.y);
  const pulse = 1 + Math.sin(_frameNow * 0.018) * 0.15;

  if (bomb.attachedSlot) {
    // Prominent RED double-ring when attached to enemy (no slow shadowBlur)
    const target = getFighter(bomb.attachedSlot);
    const rr = (target.radius + 18) * pulse;
    ctx.strokeStyle = "rgba(239, 68, 68, 0.35)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, rr + 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#ef4444";
    ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#f472b6";
    ctx.fillStyle = "rgba(244, 114, 182, 0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fde047";
    ctx.strokeStyle = "#1e1b4b";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (bomb.armTimer > 0) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + (1 - bomb.armTimer) * Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.fillStyle = bomb.armTimer > 0 ? "#fcd34d" : bomb.attachedSlot ? "#fecaca" : "#fde047";
  ctx.font = "900 13px sans-serif";
  ctx.textAlign = "center";
  const label = bomb.armTimer > 0 ? `NẠP ${bomb.armTimer.toFixed(1)}s` : `${Math.ceil(bomb.life)}s`;
  ctx.fillText(label, 0, bomb.attachedSlot ? -88 : -22);
  ctx.restore();
}

function drawBombExplosion(ex) {
  const progress = 1 - ex.life / ex.maxLife; // 0 -> 1
  const easeOut = 1 - Math.pow(1 - progress, 3);
  const curR = ex.radius * (0.2 + easeOut * 0.95);

  const isPink = ex.theme === "pink";
  const outerFire = isPink ? "rgba(219, 39, 119," : "rgba(234, 88, 12,";
  const innerFire = isPink ? "rgba(244, 114, 182," : "rgba(251, 146, 60,";

  ctx.save();
  ctx.translate(ex.x, ex.y);

  // 1. Expanding Blast Shockwave Rings
  if (progress < 0.75) {
    const ringAlpha = Math.max(0, 1 - progress / 0.75);
    ctx.strokeStyle = `rgba(254, 240, 138, ${ringAlpha * 0.9})`;
    ctx.lineWidth = Math.max(1.5, 10 * (1 - progress));
    ctx.beginPath();
    ctx.arc(0, 0, curR * 1.28, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 2. Dark Smoke Clouds (linger longer)
  for (const puff of ex.puffs) {
    const pProg = Math.max(0, (progress - puff.delay) / (1 - puff.delay));
    if (pProg <= 0) continue;
    const smokeAlpha = Math.max(0, (1 - pProg) * 0.65);
    const px = Math.cos(puff.angle) * puff.dist * easeOut * 1.15;
    const py = Math.sin(puff.angle) * puff.dist * easeOut * 1.15 - pProg * 18;
    const pr = puff.size * (0.65 + pProg * 0.6);

    ctx.fillStyle = `rgba(30, 27, 36, ${smokeAlpha})`;
    ctx.beginPath();
    ctx.arc(px, py, pr * 1.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Turbulent Fireball Puffs (layered circles avoid per-frame gradient allocation for 60fps)
  for (const puff of ex.puffs) {
    const pProg = Math.max(0, (progress - puff.delay * 0.5) / 0.75);
    if (pProg <= 0 || pProg >= 1) continue;
    const fireAlpha = Math.max(0, 1 - pProg);
    const px = Math.cos(puff.angle) * puff.dist * easeOut;
    const py = Math.sin(puff.angle) * puff.dist * easeOut;
    const pr = puff.size * (0.4 + pProg * 0.7);

    ctx.fillStyle = `${outerFire} ${fireAlpha * 0.45})`;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `${innerFire} ${fireAlpha * 0.8})`;
    ctx.beginPath();
    ctx.arc(px, py, pr * 0.68, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 255, ${fireAlpha * 0.85})`;
    ctx.beginPath();
    ctx.arc(px, py, pr * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Central Blinding Core Flash
  if (progress < 0.45) {
    const coreAlpha = Math.max(0, 1 - progress / 0.45);
    ctx.fillStyle = `rgba(254, 240, 138, ${coreAlpha * 0.75})`;
    ctx.beginPath();
    ctx.arc(0, 0, curR * 0.72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 255, ${coreAlpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, curR * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPunch(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  const alpha = p.suspended ? 0.95 : Math.min(1, p.life / (p.maxLife * 0.45));
  ctx.globalAlpha = p.isVisualOnly ? alpha * 0.78 : alpha;

  const isHeavyFist =
    p.charId === "diavolo" || p.charId === "okuyasu" || p.charId === "polnareff";
  const jolyneMobiusFist = p.isJolyneMobiusFist;
  const w = 78 * p.scale * (jolyneMobiusFist ? 1.16 : isHeavyFist ? 1.1 : 1);
  const h = 40 * p.scale * (jolyneMobiusFist ? 1.38 : isHeavyFist ? 1.25 : 1);

  // High-velocity speed streaks behind the fist (hidden during Time Stop so fists don't look spiked)
  if (!state?.timeStop?.active && !p.suspended) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.75, -h * 0.28);
    ctx.lineTo(-w * 0.25, -h * 0.28);
    ctx.moveTo(-w * 0.82, 0);
    ctx.lineTo(-w * 0.25, 0);
    ctx.moveTo(-w * 0.75, h * 0.28);
    ctx.lineTo(-w * 0.25, h * 0.28);
    ctx.stroke();
  }

  const armSprite = getMipSprite(p.img, 148);
  if (armSprite) {
    ctx.drawImage(armSprite, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = p.color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

function drawBarrageClash(c) {
  const prog = 1 - c.life / c.maxLife;
  const alpha = Math.max(0, 1 - prog);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);

  // 1. Anime wind-pressure shockwave arcs flanking left and right (no shadowBlur for 60fps)
  const arcRadius = 38 + prog * 46;
  ctx.strokeStyle = `rgba(253, 224, 71, ${alpha * 0.45})`;
  ctx.lineWidth = 9 * (1 - prog * 0.5);
  ctx.beginPath();
  ctx.arc(-14 - prog * 18, 0, arcRadius, -0.85, 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(14 + prog * 18, 0, arcRadius, Math.PI - 0.85, Math.PI + 0.85);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
  ctx.lineWidth = 3.5 * (1 - prog * 0.5);
  ctx.beginPath();
  ctx.arc(-14 - prog * 18, 0, arcRadius, -0.85, 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(14 + prog * 18, 0, arcRadius, Math.PI - 0.85, Math.PI + 0.85);
  ctx.stroke();

  // 2. Central golden-white starburst flash (zero gradient allocation)
  ctx.rotate(c.seed + prog * 1.4);
  const spikes = 10;
  const outerR = 30 + prog * 36;
  const innerR = 9 + prog * 8;

  ctx.fillStyle = `rgba(253, 224, 71, ${alpha * 0.85})`;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / spikes;
    const sx = Math.cos(a) * r;
    const sy = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.beginPath();
  ctx.arc(0, 0, innerR * 1.15, 0, Math.PI * 2);
  ctx.fill();

  // 3. Expanding crisp impact ring
  ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.9})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 18 + prog * 48, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawStarFinger(beam) {
  ctx.save();
  ctx.translate(beam.x1, beam.y1);
  ctx.rotate(beam.angle);
  ctx.globalAlpha = Math.max(0.15, Math.min(1, (beam.life / beam.maxLife) * 2.2));

  const tipX = Math.max(46, beam.length);

  // Star Platinum forearm & gold wrist cuff base
  ctx.fillStyle = "#7e22ce";
  ctx.strokeStyle = "#3b0764";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.beginPath();
  roundedRectPath(ctx, 18, -11, 24, 22, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#facc15";
  ctx.fillRect(36, -12, 6, 24);

  // Two extended purple Stand fingers (index & middle)
  for (const oy of [-5.5, 5.5]) {
    ctx.fillStyle = "#a855f7";
    ctx.strokeStyle = "#4c1d95";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(42, oy - 4.2);
    ctx.lineTo(tipX - 8, oy - 2.8);
    ctx.quadraticCurveTo(tipX + 4, oy, tipX - 8, oy + 2.8);
    ctx.lineTo(42, oy + 4.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Knuckle lines for finger look
    ctx.strokeStyle = "rgba(59, 7, 100, 0.55)";
    ctx.lineWidth = 1.2;
    for (let kx = 66; kx < tipX - 18; kx += 28) {
      ctx.beginPath();
      ctx.moveTo(kx, oy - 2.6);
      ctx.lineTo(kx, oy + 2.6);
      ctx.stroke();
    }

    // Glowing fingernail tip
    ctx.fillStyle = "#f3e8ff";
    ctx.beginPath();
    ctx.ellipse(tipX - 6, oy, 5.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle motion lines along the jab
  ctx.strokeStyle = "rgba(233, 213, 255, 0.65)";
  ctx.lineWidth = 1.5;
  for (const ly of [-14, 14]) {
    ctx.beginPath();
    ctx.moveTo(48, ly);
    ctx.lineTo(Math.max(54, tipX - 16), ly);
    ctx.stroke();
  }

  ctx.restore();
}

function drawRoadRollerTarget(rr) {
  ctx.save();
  const pulse = 0.85 + Math.sin(_frameNow * 0.018) * 0.15;
  ctx.strokeStyle = "#ef4444";
  ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.arc(rr.targetX, rr.targetY, rr.impactRadius * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRoadRollerVehicle(rr) {
  ctx.save();
  ctx.translate(rr.targetX, rr.dropY);

  if (rr.phase === "impact") {
    ctx.strokeStyle = "#fde047";
    ctx.lineWidth = 5;
    ctx.globalAlpha = Math.max(0, rr.timer / 0.65);
    ctx.beginPath();
    ctx.arc(0, 0, rr.impactRadius * (1.2 - rr.timer * 0.4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const rrSprite = getMipSprite(ASSETS.roadRoller, 300);
  if (rrSprite) {
    const sw = rrSprite.width || ASSETS.roadRoller.naturalWidth;
    const sh = rrSprite.height || ASSETS.roadRoller.naturalHeight;
    const drawW = 240;
    const drawH = (drawW * sh) / sw;
    ctx.drawImage(rrSprite, -drawW / 2, -drawH / 2 - 20, drawW, drawH);
  } else {
    ctx.fillStyle = "#eab308";
    ctx.fillRect(-90, -60, 180, 90);
  }

  ctx.restore();
}

function drawGroundCrack(crack) {
  const alpha = Math.max(0, crack.life / crack.maxLife);
  ctx.save();
  ctx.translate(crack.x, crack.y);
  ctx.rotate(crack.angle);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#1c1917";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 16);
    ctx.lineTo(Math.cos(a + 0.18) * 46, Math.sin(a + 0.18) * 30);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(244, 114, 182, 0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawMobiusWeb(web) {
  const sprite = getMipSprite(ASSETS.jolyneWeb, 220);
  ctx.save();
  ctx.translate(web.x, web.y);
  ctx.globalAlpha = web.landed ? Math.min(0.92, web.life * 0.9) : 0.95;
  const size = web.radius * 2.1;
  if (sprite) {
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
  } else {
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, web.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPolnareffClone(cl) {
  if (cl.hidden) return;
  const owner = getFighter(cl.ownerSlot);
  const activeImg = owner.armorOffTimer > 0 ? ASSETS.polnareffArmorOff : owner.img;
  const sprite = getMipSprite(activeImg, 200);
  if (!sprite) return;
  ctx.save();
  ctx.translate(cl.x, cl.y);
  ctx.globalAlpha = 0.72;
  const scale = CHAR_CONFIG.polnareff.spriteScale || 1.08;
  const targetH = cl.radius * 2.35 * scale;
  const sw = sprite.width;
  const sh = sprite.height;
  const aspect = sw / sh;
  let h = targetH;
  let w = targetH * aspect;
  const maxW = cl.radius * 2.85 * scale;
  if (w > maxW) {
    w = maxW;
    h = maxW / aspect;
  }
  ctx.scale(cl.facing, 1);
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  ctx.restore();

  const barWidth = 56;
  const barHeight = 7;
  const barX = cl.x - barWidth / 2;
  const barY = cl.y - cl.radius - 14;
  const healthRatio = Math.max(0, cl.hp / cl.maxHp);
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = healthRatio > 0.35 ? "#4ade80" : "#f87171";
  ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * healthRatio, barHeight - 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
  ctx.restore();
}

function drawDashAfterimage(afterimage) {
  const sprite = getMipSprite(afterimage.img, 180);
  if (!sprite) return;
  const scale = CHAR_CONFIG[afterimage.charId].spriteScale || 1;
  const targetH = afterimage.radius * 2.35 * scale;
  const aspect = sprite.width / sprite.height;
  const h = Math.min(targetH, (afterimage.radius * 2.85 * scale) / aspect);
  const w = h * aspect;

  ctx.save();
  ctx.translate(afterimage.x, afterimage.y);
  ctx.globalAlpha = 0.3 * (afterimage.life / afterimage.maxLife);
  ctx.scale(afterimage.facing, 1);
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawSpriteProjectile(img, x, y, drawSize, angle) {
  const sprite = getMipSprite(img, 180);
  if (!sprite) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const aspect = sprite.width / sprite.height;
  const w = drawSize;
  const h = drawSize / aspect;
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawDiavoloTimeSkipZone(zone) {
  const progress = 1 - zone.life / zone.maxLife;
  const radius = zone.radius * (0.82 + progress * 0.18);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.fillStyle = zone.hit ? "rgba(239, 68, 68, 0.24)" : "rgba(239, 68, 68, 0.14)";
  ctx.strokeStyle = "rgba(248, 113, 113, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(zone.x, zone.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawDiavoloImpale(impale) {
  if (impale.phase === "pin" || impale.armTimer <= 0) return;
  const target = getFighter(impale.targetSlot);
  if (target.hidden) return;
  const x = target.x - impale.facing * target.radius * 0.35;
  drawSpriteProjectile(CHAR_CONFIG.diavolo.armAsset(), x, target.y, 150, impale.facing > 0 ? 0 : Math.PI);
}

function drawEraseSwipe(swipe) {
  const sprite = getMipSprite(ASSETS.theHandEraseVfx, 220);
  if (!sprite) return;
  const prog = 1 - swipe.life / swipe.maxLife;
  ctx.save();
  ctx.translate(swipe.x, swipe.y);
  ctx.rotate(swipe.angle + Math.PI);
  ctx.globalAlpha = Math.max(0, 1 - prog * 0.85);
  const h = 155 + prog * 35;
  const w = h * (sprite.width / sprite.height);
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawStringFinger(sf) {
  ctx.save();
  ctx.translate(sf.x1, sf.y1);
  ctx.rotate(sf.angle);
  ctx.globalAlpha = Math.max(0.2, Math.min(1, (sf.life / sf.maxLife) * 2.2));
  const tipX = Math.max(44, sf.length);
  for (const oy of [-5, 5]) {
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(28, oy);
    ctx.lineTo(tipX, oy);
    ctx.stroke();
    ctx.fillStyle = "#cffafe";
    ctx.beginPath();
    ctx.arc(tipX, oy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (sf.phase === "spin" || sf.phase === "slam") {
    ctx.strokeStyle = "#cffafe";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(tipX - 2, 0, 10, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(tipX - 8, 0, 7, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ── UI Updates (Diff-cached to prevent 60fps DOM layout thrashing) ──
const _uiCache = {};
function resetUiCache() {
  for (const k of Object.keys(_uiCache)) delete _uiCache[k];
}
function setCachedText(key, el, val) {
  if (!el || _uiCache[key] === val) return;
  _uiCache[key] = val;
  el.textContent = val;
}
function setCachedWidth(key, el, val) {
  if (!el || _uiCache[key] === val) return;
  _uiCache[key] = val;
  el.style.width = val;
}
function setCachedHeight(key, el, val) {
  if (!el || _uiCache[key] === val) return;
  _uiCache[key] = val;
  el.style.height = val;
}

function updateHpUI() {
  if (!state) return;
  const p = state.p1;
  const a = state.p2;

  const pPct = Math.max(0, (p.hp / p.maxHp) * 100);
  const aPct = Math.max(0, (a.hp / a.maxHp) * 100);

  const pW = `${pPct.toFixed(1)}%`;
  const aW = `${aPct.toFixed(1)}%`;
  setCachedWidth("p1HpW", p1HpFill, pW);
  setCachedWidth("p1TrailW", p1HpTrail, pW);
  setCachedText("p1HpT", p1HpText, `${p.hp <= 0 ? 0 : Math.max(1, Math.round(pPct))}%`);
  setCachedWidth("p1GW", p1GuardFill, `${((p.guardPool / MAX_GUARD_POOL) * 100).toFixed(1)}%`);

  setCachedWidth("p2HpW", p2HpFill, aW);
  setCachedWidth("p2TrailW", p2HpTrail, aW);
  setCachedText("p2HpT", p2HpText, `${a.hp <= 0 ? 0 : Math.max(1, Math.round(aPct))}%`);
  setCachedWidth("p2GW", p2GuardFill, `${((a.guardPool / MAX_GUARD_POOL) * 100).toFixed(1)}%`);
}

function updateSkillBarUI() {
  if (!state) return;
  const p = state.p1;
  const cds = state.cooldowns.p1;
  const cfgSkills = CHAR_CONFIG[p.charId].skills;

  for (const k of ["q", "e", "r"]) {
    const cd = cds[k];
    const max = cfgSkills[k].cd;
    const ui = skillBtns[k];
    const mBtn = document.getElementById(`m-btn-${k}`);
    const mCd = document.getElementById(`m-cd-${k}`);
    if (cd > 0) {
      const txt = cd >= 10 ? `${Math.ceil(cd)}s` : `${cd.toFixed(1)}s`;
      ui.btn.classList.add("on-cooldown");
      setCachedHeight(`ov_${k}`, ui.overlay, `${((cd / max) * 100).toFixed(1)}%`);
      setCachedText(`tx_${k}`, ui.text, txt);
      if (mBtn && mCd) {
        mBtn.classList.add("on-cooldown");
        setCachedText(`mtx_${k}`, mCd, txt);
      }
    } else {
      ui.btn.classList.remove("on-cooldown");
      setCachedHeight(`ov_${k}`, ui.overlay, "0%");
      setCachedText(`tx_${k}`, ui.text, "");
      if (mBtn && mCd) {
        mBtn.classList.remove("on-cooldown");
        setCachedText(`mtx_${k}`, mCd, "");
      }
    }
  }

  const dashCd = cds.dash;
  const mDashBtn = document.getElementById("m-btn-dash");
  const mDashCd = document.getElementById("m-cd-dash");
  if (dashCd > 0) {
    const txt = `${dashCd.toFixed(1)}s`;
    skillBtns.dash.btn.classList.add("on-cooldown");
    setCachedHeight("ov_dash", skillBtns.dash.overlay, `${((dashCd / (cds.dashMax || DASH_COOLDOWN)) * 100).toFixed(1)}%`);
    setCachedText("tx_dash", skillBtns.dash.text, txt);
    if (mDashBtn && mDashCd) {
      mDashBtn.classList.add("on-cooldown");
      setCachedText("mtx_dash", mDashCd, txt);
    }
  } else {
    skillBtns.dash.btn.classList.remove("on-cooldown");
    setCachedHeight("ov_dash", skillBtns.dash.overlay, "0%");
    setCachedText("tx_dash", skillBtns.dash.text, "");
    if (mDashBtn && mDashCd) {
      mDashBtn.classList.remove("on-cooldown");
      setCachedText("mtx_dash", mDashCd, "");
    }
  }

  if (p.charId === "kira") {
    const activeBomb = state.firstBombs.find((b) => b.ownerSlot === "p1");
    const mTBtn = document.getElementById("m-btn-t");
    const mTCd = document.getElementById("m-cd-t");
    if (activeBomb) {
      const txt = `${Math.ceil(activeBomb.life)}s`;
      skillBtns.t.btn.classList.remove("on-cooldown");
      skillBtns.t.btn.classList.add("bomb-ready");
      setCachedText("tx_t", skillBtns.t.text, txt);
      if (mTBtn && mTCd) {
        mTBtn.classList.remove("on-cooldown");
        mTBtn.classList.add("bomb-ready");
        setCachedText("mtx_t", mTCd, txt);
      }
    } else {
      skillBtns.t.btn.classList.add("on-cooldown");
      skillBtns.t.btn.classList.remove("bomb-ready");
      setCachedText("tx_t", skillBtns.t.text, "");
      if (mTBtn && mTCd) {
        mTBtn.classList.add("on-cooldown");
        mTBtn.classList.remove("bomb-ready");
        setCachedText("mtx_t", mTCd, "");
      }
    }
  }

  const guardText = p.guardBrokenTimer > 0 ? `Vỡ ${p.guardBrokenTimer.toFixed(1)}s` : "Block";
  setCachedText("guard_f", guardDescEl, guardText);
  guardBtnEl.classList.toggle("guard-active", p.isGuarding);

  const mGuardBtn = document.getElementById("m-btn-f");
  const mGuardSub = document.getElementById("m-guard-sub");
  if (mGuardBtn) mGuardBtn.classList.toggle("guard-active", p.isGuarding);
  setCachedText("mguard_f", mGuardSub, guardText);
}

// ── Main Loop & Controls ────────────────────────────────────
function gameLoop(timestamp) {
  const isBlocked = document.hidden || document.body.classList.contains("portrait-blocked");
  if (!state || !state.running || state.gameOver || isBlocked) {
    lastTime = timestamp;
    setTimeout(() => requestAnimationFrame(gameLoop), document.hidden ? 500 : 160);
    return;
  }

  if (timestamp - lastRenderTime < targetFrameInterval) {
    requestAnimationFrame(gameLoop);
    return;
  }

  const dt = Math.min(0.05, (timestamp - lastTime) / 1000 || 0);
  lastTime = timestamp;
  lastRenderTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keysPressed.add(k);
  if (!state || !state.running) return;
  if (e.key === "Shift") {
    e.preventDefault();
    triggerDash(state.p1);
    return;
  }
  if ((k === "q" || k === "e" || k === "r" || k === "t") && e.repeat) return;
  if (k === "q" || k === "e" || k === "r" || k === "t") {
    castSkill("p1", k);
  }
});

window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  keysPressed.delete(k);
  if (k === "q" && state?.p1?.isChargingTimeStop) {
    cancelTimeStopCharge(state.p1, "HỦY CHIÊU!");
  }
  if (state?.p1?.barrageQueue && state.p1.barrageQueue.skillKey === k) {
    releaseBarrage(state.p1);
  }
});

window.addEventListener("blur", () => {
  keysPressed.clear();
  if (state?.p1?.isChargingTimeStop) {
    cancelTimeStopCharge(state.p1, "HỦY CHIÊU!");
  }
  if (state?.p1?.barrageQueue) {
    releaseBarrage(state.p1);
  }
});

skillBtns.q.btn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (state) castSkill("p1", "q");
});
for (const ev of ["pointerup", "pointercancel", "pointerleave"]) {
  skillBtns.q.btn.addEventListener(ev, () => {
    if (state?.p1?.isChargingTimeStop) {
      cancelTimeStopCharge(state.p1, "HỦY CHIÊU!");
    }
  });
}
for (const k of ["e", "r"]) {
  skillBtns[k].btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state) castSkill("p1", k);
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) {
    skillBtns[k].btn.addEventListener(ev, () => {
      if (state?.p1?.barrageQueue && state.p1.barrageQueue.skillKey === k) {
        releaseBarrage(state.p1);
      }
    });
  }
}
skillBtns.t.btn.addEventListener("click", () => state && castSkill("p1", "t"));
skillBtns.dash.btn.addEventListener("click", () => state && triggerDash(state.p1));

function updateSkillPreview(charId) {
  const cfg = CHAR_CONFIG[charId];
  if (!cfg) return;
  const nameEl = document.getElementById("preview-char-name");
  const skillsEl = document.getElementById("preview-char-skills");
  if (nameEl) nameEl.textContent = cfg.name;
  if (skillsEl) {
    skillsEl.replaceChildren();
    const skillEntries = [
      ["Q", cfg.skills.q],
      ["E", cfg.skills.e],
      ["R", cfg.skills.r],
    ];
    for (const [key, skill] of skillEntries) {
      const item = document.createElement("span");
      item.title = `${skill.name}: ${skill.desc}`;
      const badge = document.createElement("b");
      badge.textContent = key;
      item.append(badge, document.createTextNode(` ${skill.name}`));
      const cooldown = document.createElement("small");
      cooldown.textContent = `CD ${skill.cd}s`;
      item.append(cooldown);
      skillsEl.append(item);
    }
    if (charId === "kira") {
      const item = document.createElement("span");
      item.title = "Kích nổ First Bomb";
      const badge = document.createElement("b");
      badge.textContent = "T";
      item.append(badge, document.createTextNode(" KÍCH NỔ"));
      skillsEl.append(item);
    }
  }
}

function shouldSkipSceneVideo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return Boolean(connection?.saveData || reducedMotion);
}

function releaseSceneVideo(video) {
  if (!video) return;
  video.pause();
  video.removeAttribute("src");
  video.dataset.activeAsset = "";
  video.removeAttribute("data-video-fallback");
  video.load();
}

function playSceneVideo(video, asset) {
  if (!video || !asset || shouldSkipSceneVideo() || document.hidden) return;
  if (video.dataset.activeAsset !== asset) {
    releaseSceneVideo(video);
    video.dataset.activeAsset = asset;
    video.onerror = () => {
      video.dataset.videoFallback = "true";
    };
    video.onloadeddata = () => {
      video.removeAttribute("data-video-fallback");
    };
    video.src = encodeURI(asset);
    video.load();
  }
  const playRequest = video.play();
  if (playRequest) {
    playRequest.catch(() => {
      video.dataset.videoFallback = "true";
    });
  }
}

function showMainMenuVideo() {
  const asset = mainMenuVideo?.dataset.src;
  if (
    asset &&
    !mainMenuOverlay.classList.contains("hidden") &&
    settingsOverlay.classList.contains("hidden") &&
    !document.body.classList.contains("portrait-blocked")
  ) {
    playSceneVideo(mainMenuVideo, asset);
  } else {
    mainMenuVideo?.pause();
  }
}

function showCharacterPreviewVideo(charId) {
  const imageAsset = CHARACTER_PREVIEW_IMAGES[charId];
  const videoAsset = CHARACTER_PREVIEW_VIDEOS[charId];
  if (!imageAsset || !characterPreviewVideo || !characterPreviewImage) return;
  const encodedImage = encodeURI(imageAsset);
  if (characterPreviewImage.dataset.activeAsset !== imageAsset) {
    characterPreviewImage.src = encodedImage;
    characterPreviewImage.dataset.activeAsset = imageAsset;
  }
  const useVideo = graphicsMode === "high" && !shouldSkipSceneVideo();
  selectOverlay.dataset.previewMode = useVideo ? "video" : "image";
  if (!useVideo) {
    if (characterPreviewSwitchTimer) clearTimeout(characterPreviewSwitchTimer);
    releaseSceneVideo(characterPreviewVideo);
    return;
  }
  if (characterPreviewVideo.dataset.activeAsset !== videoAsset) {
    characterPreviewVideo.poster = encodedImage;
  }
  if (characterPreviewSwitchTimer) clearTimeout(characterPreviewSwitchTimer);
  characterPreviewSwitchTimer = setTimeout(() => {
    if (selectOverlay.classList.contains("hidden") || document.hidden) return;
    playSceneVideo(characterPreviewVideo, videoAsset);
  }, 140);
}

function updateDeviceActionStatus(message) {
  for (const status of document.querySelectorAll(".device-action-status")) {
    status.textContent = message;
  }
}

function updateDeviceActionLabels() {
  for (const button of document.querySelectorAll('[data-device-action="fullscreen"]')) {
    const active = Boolean(document.fullscreenElement);
    button.textContent = button.closest("#hud")
      ? "⛶"
      : (active ? "⛶ THOÁT TOÀN MÀN HÌNH" : "⛶ TOÀN MÀN HÌNH");
    button.title = active ? "Thoát toàn màn hình" : "Bật toàn màn hình";
  }
  for (const button of document.querySelectorAll('[data-device-action="orientation"]')) {
    button.textContent = button.closest("#hud")
      ? (isLandscapeLocked ? "🔓" : "🔒")
      : (isLandscapeLocked ? "🔓 MỞ KHÓA XOAY" : "🔒 KHÓA XOAY NGANG");
    button.title = isLandscapeLocked ? "Mở khóa xoay màn hình" : "Khóa xoay ngang";
  }
}

let isLandscapeLocked = false;

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      updateDeviceActionStatus("");
    } else if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      updateDeviceActionStatus("");
    } else {
      updateDeviceActionStatus("Trình duyệt này không hỗ trợ toàn màn hình.");
    }
  } catch (error) {
    updateDeviceActionStatus(`Không thể bật toàn màn hình: ${error.message}`);
  }
  updateDeviceActionLabels();
}

async function toggleLandscapeLock() {
  if (isLandscapeLocked) {
    screen.orientation?.unlock();
    isLandscapeLocked = false;
    updateDeviceActionStatus("Đã mở khóa xoay màn hình.");
    updateDeviceActionLabels();
    return;
  }
  if (!screen.orientation?.lock) {
    updateDeviceActionStatus("Trình duyệt không hỗ trợ khóa xoay; hãy bật toàn màn hình hoặc tự xoay máy.");
    return;
  }
  try {
    await screen.orientation.lock("landscape");
    isLandscapeLocked = true;
    updateDeviceActionStatus("Đã khóa màn hình ngang.");
    updateDeviceActionLabels();
  } catch (error) {
    updateDeviceActionStatus(`Không khóa được màn hình: ${error.message}`);
  }
}

document.querySelectorAll("[data-device-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.deviceAction === "fullscreen") {
      toggleFullscreen();
    } else if (button.dataset.deviceAction === "orientation") {
      toggleLandscapeLock();
    }
  });
});
document.addEventListener("fullscreenchange", updateDeviceActionLabels);
window.addEventListener("orientationchange", () => {
  updateDeviceActionStatus("");
  syncMobileControlsVisibility();
});
updateDeviceActionLabels();

function setGraphicsMode(mode, persist = true) {
  graphicsMode = mode === "high" ? "high" : "normal";
  selectOverlay.dataset.graphicsMode = graphicsMode;
  targetFrameInterval = 1000 / (graphicsMode === "high" ? 120 : 60);
  if (graphicsModeLabel) {
    graphicsModeLabel.textContent = graphicsMode === "high"
      ? "CAO · TỐI ĐA 120 FPS"
      : "BÌNH THƯỜNG · 60 FPS";
  }
  document.querySelectorAll("[data-graphics-mode]").forEach((button) => {
    if (!button.matches("button")) return;
    const selected = button.dataset.graphicsMode === graphicsMode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (persist) {
    try {
      localStorage.setItem(GRAPHICS_STORAGE_KEY, graphicsMode);
    } catch (error) {
      console.warn("Unable to save graphics mode:", error);
    }
  }
  syncArenaSize();
  if (!selectOverlay.classList.contains("hidden")) {
    showCharacterPreviewVideo(activeSelectionSide === "p1" ? selectedPlayerChar : selectedAiChar);
  }
}

function updateCharacterSelectUI() {
  const p1Cfg = CHAR_CONFIG[selectedPlayerChar];
  const aiCfg = CHAR_CONFIG[selectedAiChar];
  const p1Name = p1Cfg?.name || "JOTARO";
  const aiName = aiCfg?.name || "DIO";
  const p1NameEl = document.getElementById("p1-selection-name");
  const p1TabNameEl = document.getElementById("active-p1-name");
  const aiTabNameEl = document.getElementById("active-ai-name");
  const sideLabelEl = document.getElementById("preview-side-label");

  if (p1NameEl) p1NameEl.textContent = p1Name;
  if (p1TabNameEl) p1TabNameEl.textContent = p1Name;
  if (aiTabNameEl) aiTabNameEl.textContent = aiName;
  if (aiColHeader) aiColHeader.textContent = aiName;
  if (sideLabelEl) {
    sideLabelEl.textContent = activeSelectionSide === "p1"
      ? "PLAYER 1 · YOUR STAND"
      : "CPU / AI · OPPONENT STAND";
  }
  selectOverlay.dataset.activeSide = activeSelectionSide;

  document.querySelectorAll("#player-char-grid .char-card").forEach((card) => {
    const charId = card.dataset.char;
    const isP1 = charId === selectedPlayerChar;
    const isAi = charId === selectedAiChar;
    const isActive = charId === (activeSelectionSide === "p1" ? selectedPlayerChar : selectedAiChar);
    card.classList.toggle("is-p1-selected", isP1);
    card.classList.toggle("is-ai-selected", isAi);
    card.classList.toggle("active-choice", isActive);
    card.classList.toggle("ai-choice", isActive && activeSelectionSide === "ai");
    card.setAttribute("aria-pressed", String(isActive));
  });

  document.querySelectorAll(".selection-side-btn").forEach((button) => {
    const isActive = button.dataset.side === activeSelectionSide;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function setActiveSelectionSide(side) {
  activeSelectionSide = side === "ai" ? "ai" : "p1";
  const charId = activeSelectionSide === "p1" ? selectedPlayerChar : selectedAiChar;
  updateCharacterSelectUI();
  revealRosterSelection(charId);
  updateSkillPreview(charId);
  showCharacterPreviewVideo(charId);
}

// Character & Opponent Select
document.getElementById("player-char-grid").addEventListener("click", (event) => {
  const card = event.target.closest(".char-card");
  if (!card) return;
  if (activeSelectionSide === "p1") selectedPlayerChar = card.dataset.char;
  else selectedAiChar = card.dataset.char;
  updateCharacterSelectUI();
  const charId = activeSelectionSide === "p1" ? selectedPlayerChar : selectedAiChar;
  updateSkillPreview(charId);
  showCharacterPreviewVideo(charId);
});

document.querySelectorAll(".selection-side-btn").forEach((button) => {
  button.addEventListener("click", () => setActiveSelectionSide(button.dataset.side));
});

document.getElementById("random-ai-btn").addEventListener("click", () => {
  const pool = Object.keys(CHARACTER_PREVIEW_VIDEOS);
  selectedAiChar = pool[Math.floor(Math.random() * pool.length)];
  setActiveSelectionSide("ai");
});

document.querySelectorAll("#ai-diff-bar .diff-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#ai-diff-bar .diff-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    document.querySelectorAll("#ai-diff-bar .diff-btn").forEach((b) => {
      b.setAttribute("aria-pressed", String(b === btn));
    });
    selectedAiDifficulty = btn.dataset.diff;
    const dCfg = AI_DIFFICULTIES[selectedAiDifficulty] || AI_DIFFICULTIES.hard;
    if (aiDiffDesc) aiDiffDesc.textContent = dCfg.desc;
  });
});
document.querySelectorAll(".graphics-option").forEach((button) => {
  button.addEventListener("click", () => setGraphicsMode(button.dataset.graphicsMode));
});
updateCharacterSelectUI();
updateSkillPreview(selectedPlayerChar);
setGraphicsMode(graphicsMode, false);

const characterRoster = document.getElementById("player-char-grid");
const rosterPrevBtn = document.getElementById("roster-prev-btn");
const rosterNextBtn = document.getElementById("roster-next-btn");

function syncRosterNavigation() {
  const maxScroll = characterRoster.scrollWidth - characterRoster.clientWidth;
  rosterPrevBtn.disabled = characterRoster.scrollLeft <= 1;
  rosterNextBtn.disabled = characterRoster.scrollLeft >= maxScroll - 1;
}

function revealRosterSelection(charId) {
  const selectedCard = characterRoster.querySelector(`.char-card[data-char="${charId}"]`);
  if (!selectedCard) return;
  const rosterBounds = characterRoster.getBoundingClientRect();
  const cardBounds = selectedCard.getBoundingClientRect();
  let scrollDistance = 0;
  if (cardBounds.left < rosterBounds.left) {
    scrollDistance = cardBounds.left - rosterBounds.left;
  } else if (cardBounds.right > rosterBounds.right) {
    scrollDistance = cardBounds.right - rosterBounds.right;
  }
  if (scrollDistance) {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    characterRoster.scrollBy({ left: scrollDistance, behavior });
  }
}

function scrollCharacterRoster(direction) {
  const firstCard = characterRoster.querySelector(".char-card");
  const columnGap = Number.parseFloat(getComputedStyle(characterRoster).columnGap) || 0;
  const scrollDistance = firstCard
    ? firstCard.getBoundingClientRect().width + columnGap
    : characterRoster.clientWidth;
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  characterRoster.scrollBy({ left: direction * scrollDistance, behavior });
}

rosterPrevBtn.addEventListener("click", () => scrollCharacterRoster(-1));
rosterNextBtn.addEventListener("click", () => scrollCharacterRoster(1));
characterRoster.addEventListener("scroll", syncRosterNavigation, { passive: true });
window.addEventListener("resize", syncRosterNavigation);

// Navigation & Modals
document.getElementById("goto-select-btn").addEventListener("click", () => {
  releaseSceneVideo(mainMenuVideo);
  mainMenuOverlay.classList.add("hidden");
  selectOverlay.classList.remove("hidden");
  setActiveSelectionSide("p1");
  requestAnimationFrame(syncRosterNavigation);
});

document.getElementById("back-to-menu-btn").addEventListener("click", () => {
  releaseSceneVideo(characterPreviewVideo);
  selectOverlay.classList.add("hidden");
  mainMenuOverlay.classList.remove("hidden");
  showMainMenuVideo();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    mainMenuVideo?.pause();
    characterPreviewVideo?.pause();
    return;
  }
  if (!mainMenuOverlay.classList.contains("hidden")) {
    showMainMenuVideo();
  } else if (!selectOverlay.classList.contains("hidden")) {
    showCharacterPreviewVideo(activeSelectionSide === "p1" ? selectedPlayerChar : selectedAiChar);
  }
});

document.getElementById("start-btn").addEventListener("click", startMatchWithIntro);
document.getElementById("end-replay-btn").addEventListener("click", startMatchWithIntro);

function returnToMainMenu() {
  if (state) state.running = false;
  if (vsTimerHandle) clearTimeout(vsTimerHandle);
  if (endTimerHandle) clearTimeout(endTimerHandle);
  releaseSceneVideo(characterPreviewVideo);
  stopAllSounds();
  vsIntroOverlay.classList.add("hidden");
  resultBanner.classList.add("hidden");
  endOverlay.classList.add("hidden");
  selectOverlay.classList.add("hidden");
  mainMenuOverlay.classList.remove("hidden");
  syncMobileControlsVisibility();
  showMainMenuVideo();
  startLobbyBgm();
}

document.getElementById("end-menu-btn").addEventListener("click", returnToMainMenu);
menuBtn.addEventListener("click", returnToMainMenu);

// Audio & Settings
muteBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  muteBtn.textContent = isMuted ? "🔇" : "🔊";
  if (isMuted) {
    stopAllSounds();
  } else {
    ensureDesiredBgmPlaying();
  }
});

toggleSfxBtn.addEventListener("click", () => {
  isSfxMuted = !isSfxMuted;
  toggleSfxBtn.classList.toggle("on", !isSfxMuted);
  toggleSfxBtn.textContent = isSfxMuted ? "🔇 TẮT" : "🔊 BẬT";
});

toggleBgmBtn.addEventListener("click", () => {
  isBgmMuted = !isBgmMuted;
  toggleBgmBtn.classList.toggle("on", !isBgmMuted);
  toggleBgmBtn.textContent = isBgmMuted ? "🔇 TẮT" : "🎵 BẬT";
  updateBgmVolumeLive();
});

function openSettings() {
  settingsOverlay.classList.remove("hidden");
  mainMenuVideo?.pause();
}

settingsBtn.addEventListener("click", openSettings);
document.getElementById("menu-settings-btn").addEventListener("click", openSettings);
document.getElementById("close-settings-btn").addEventListener("click", () => {
  settingsOverlay.classList.add("hidden");
  showMainMenuVideo();
});

sfxSlider.addEventListener("input", () => {
  sfxVolume = Number(sfxSlider.value) / 100;
  sfxValEl.textContent = `${sfxSlider.value}%`;
});

bgmSlider.addEventListener("input", () => {
  bgmVolume = Number(bgmSlider.value) / 100;
  bgmValEl.textContent = `${bgmSlider.value}%`;
  updateBgmVolumeLive();
});

// ── Mobile Touch Controls (Analog Joystick + Right Skill Pad) ──
const mobileControlsEl = document.getElementById("mobile-controls");
const joystickZoneEl = document.getElementById("touch-joystick-zone");
const joystickBaseEl = document.getElementById("joystick-base");
const joystickKnobEl = document.getElementById("joystick-knob");
const toggleTouchBtn = document.getElementById("toggle-touch-btn");

function syncMobileControlsVisibility() {
  const isTouch = isTouchDeviceOrSmallScreen();
  const isPortrait = isTouch && window.innerHeight > window.innerWidth;
  const needsLandscape = isPortrait;
  document.body.classList.toggle("portrait-blocked", needsLandscape);
  if (isPortrait) {
    mainMenuVideo?.pause();
    characterPreviewVideo?.pause();
  } else if (!state?.running && mainMenuOverlay && !mainMenuOverlay.classList.contains("hidden")) {
    showMainMenuVideo();
  } else if (!selectOverlay.classList.contains("hidden")) {
    showCharacterPreviewVideo(activeSelectionSide === "p1" ? selectedPlayerChar : selectedAiChar);
  }
  const show =
    Boolean(state?.running) &&
    !isPortrait &&
    (touchMode === "on" || (touchMode === "auto" && isTouch));
  mobileControlsEl.classList.toggle("hidden", !show);
}

window.addEventListener("resize", syncMobileControlsVisibility);
syncMobileControlsVisibility();

toggleTouchBtn.addEventListener("click", () => {
  if (touchMode === "auto") touchMode = "on";
  else if (touchMode === "on") touchMode = "off";
  else touchMode = "auto";

  if (touchMode === "on") {
    toggleTouchBtn.textContent = "📱 LUÔN BẬT";
    toggleTouchBtn.classList.add("on");
  } else if (touchMode === "off") {
    toggleTouchBtn.textContent = "🚫 TẮT";
    toggleTouchBtn.classList.remove("on");
  } else {
    toggleTouchBtn.textContent = "📱 TỰ ĐỘNG";
    toggleTouchBtn.classList.remove("on");
  }
  syncMobileControlsVisibility();
});

let joystickPointerId = null;

function updateJoystickFromPointer(clientX, clientY) {
  const rect = joystickBaseEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxR = rect.width * 0.38;

  let dx = clientX - cx;
  let dy = clientY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR && dist > 0) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }

  joystickKnobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  touchInput.x = dx / maxR;
  touchInput.y = dy / maxR;
}

function resetJoystick() {
  joystickPointerId = null;
  touchInput.x = 0;
  touchInput.y = 0;
  joystickKnobEl.style.transform = "translate(0px, 0px)";
}

joystickZoneEl.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (joystickPointerId !== null) return;
  joystickPointerId = e.pointerId;
  joystickZoneEl.setPointerCapture(e.pointerId);
  updateJoystickFromPointer(e.clientX, e.clientY);
});

joystickZoneEl.addEventListener("pointermove", (e) => {
  if (e.pointerId !== joystickPointerId) return;
  e.preventDefault();
  updateJoystickFromPointer(e.clientX, e.clientY);
});

joystickZoneEl.addEventListener("pointerup", (e) => {
  if (e.pointerId === joystickPointerId) resetJoystick();
});
joystickZoneEl.addEventListener("pointercancel", (e) => {
  if (e.pointerId === joystickPointerId) resetJoystick();
});

for (const k of ["q", "e", "r", "t"]) {
  const mBtn = document.getElementById(`m-btn-${k}`);
  if (!mBtn) continue;
  mBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state) castSkill("p1", k);
  });
  if (k === "q") {
    for (const ev of ["pointerup", "pointercancel"]) {
      mBtn.addEventListener(ev, () => {
        if (state?.p1?.isChargingTimeStop) {
          cancelTimeStopCharge(state.p1, "HỦY CHIÊU!");
        }
      });
    }
  } else if (k === "e" || k === "r") {
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) {
      mBtn.addEventListener(ev, () => {
        if (state?.p1?.barrageQueue && state.p1.barrageQueue.skillKey === k) {
          releaseBarrage(state.p1);
        }
      });
    }
  }
}

const mDashBtn = document.getElementById("m-btn-dash");
if (mDashBtn) {
  mDashBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state) triggerDash(state.p1);
  });
}

const mGuardBtn = document.getElementById("m-btn-f");
if (mGuardBtn) {
  mGuardBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    touchInput.guarding = true;
    mGuardBtn.setPointerCapture(e.pointerId);
  });
  mGuardBtn.addEventListener("pointerup", () => {
    touchInput.guarding = false;
  });
  mGuardBtn.addEventListener("pointercancel", () => {
    touchInput.guarding = false;
  });
}

showMainMenuVideo();
draw();
lastTime = performance.now();
requestAnimationFrame(gameLoop);

// ── Mobile Anti-Zoom & Strict Landscape Lock ────────────────
let _lastTouchEndTime = 0;
let _lastTouchTarget = null;
document.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);
document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    const inGameplay = Boolean(e.target.closest("#mobile-controls, #arena-container"));
    if (
      now - _lastTouchEndTime <= 320 &&
      (inGameplay || e.target === _lastTouchTarget) &&
      !e.target.closest("input[type='range']")
    ) {
      e.preventDefault();
    }
    _lastTouchEndTime = now;
    _lastTouchTarget = e.target;
  },
  { passive: false }
);
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
for (const gev of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(gev, (e) => e.preventDefault(), { passive: false });
}

window.addEventListener("pointerdown", () => ensureDesiredBgmPlaying(), { passive: true });
window.addEventListener("keydown", () => ensureDesiredBgmPlaying(), { passive: true });
