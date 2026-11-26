// ============================================================
// JOJO BIZARRE ARENA 2D — Beta v2.1
// Jotaro vs DIO vs Yoshikage Kira
// ============================================================

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");
const arenaContainer = document.getElementById("arena-container");

const ARENA_PAD = 12;
let ARENA_LEFT = ARENA_PAD;
let ARENA_TOP = ARENA_PAD;
let ARENA_RIGHT = canvas.width - ARENA_PAD;
let ARENA_BOTTOM = canvas.height - ARENA_PAD;
let ARENA_W = ARENA_RIGHT - ARENA_LEFT;
let ARENA_H = ARENA_BOTTOM - ARENA_TOP;
let ARENA_CX = canvas.width / 2;
let ARENA_CY = canvas.height / 2;

let state = null;

function syncArenaSize() {
  if (!arenaContainer) return;
  const rect = arenaContainer.getBoundingClientRect();
  const w = Math.max(640, Math.floor(rect.width));
  const h = Math.max(360, Math.floor(rect.height));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ARENA_LEFT = ARENA_PAD;
  ARENA_TOP = ARENA_PAD;
  ARENA_RIGHT = canvas.width - ARENA_PAD;
  ARENA_BOTTOM = canvas.height - ARENA_PAD;
  ARENA_W = ARENA_RIGHT - ARENA_LEFT;
  ARENA_H = ARENA_BOTTOM - ARENA_TOP;
  ARENA_CX = canvas.width / 2;
  ARENA_CY = canvas.height / 2;

  if (state) {
    for (const f of [state.p1, state.p2]) {
      f.x = Math.max(ARENA_LEFT + f.radius, Math.min(ARENA_RIGHT - f.radius, f.x));
      f.y = Math.max(ARENA_TOP + f.radius, Math.min(ARENA_BOTTOM - f.radius, f.y));
    }
  }
}

window.addEventListener("resize", syncArenaSize);
if (typeof ResizeObserver !== "undefined" && arenaContainer) {
  new ResizeObserver(syncArenaSize).observe(arenaContainer);
}
syncArenaSize();

const MAX_HP = 300;
const MAX_GUARD_POOL = 20; // Shield blocks up to 20 DMG total
const GUARD_FULL_RECHARGE_SECONDS = 25; // 25s to recharge from 0 to 20
const GUARD_LOCK_SECONDS = 4; // 4s lock on shield break
const DASH_COOLDOWN = 5;

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

const ASSETS = {
  jotaro: loadImage("Jotaro/Jotaro_with_stand.png"),
  dio: loadImage("Dio/dio_with_stand.png"),
  kira: loadImage("killerqueen/kira_with_stand.png"),
  armSP: loadImage("Jotaro/arm_star_platinum.png"),
  armTW: loadImage("Dio/arm_the_world.png"),
  armKQ: loadImage("killerqueen/arm_killer_queen.png"),
  roadRoller: loadImage("Dio/road_roller.png"),
};

// ── Audio Manager ───────────────────────────────────────────
const SOUNDS = {
  jotaroBarrage: { file: "Jotaro/jotaro barrage.mp3", gain: 1.35 },
  jotaroStarFinger: { file: "Jotaro/jotaro star_finger.mp3", gain: 1.35 },
  jotaroZaWarudo: { file: "Jotaro/jotaro_zawarudo.mp3", gain: 1.85 },
  dioBarrage: { file: "Dio/dio Barrage.mp3", gain: 0.9 },
  dioRoadRoller: { file: "Dio/ROAD ROLLER DA!!!.mp3", gain: 0.95 },
  dioTimeStop: { file: "Dio/Dio_time_stop.mp3", gain: 1.0 },
  dioLaugh: { file: "Dio/Dio Laughing.mp3", gain: 0.65 },
  dioGreatestHigh: { file: "Dio/THIS IS THE GREATEST HIGH (Dio.mp3", gain: 0.65 },
  kiraBarrage: { file: "killerqueen/killerqueen_barrage.mp3", gain: 1.1 },
  kiraDetonate: { file: "killerqueen/Killer Queen Detonate.mp3", gain: 1.3 },
  kiraSwitch: { file: "killerqueen/Killer Queen First Bomb Switch.mp3", gain: 1.3 },
  kiraBiteTheDust: { file: "killerqueen/KillerQueen_BiteTheDust.mp3", gain: 1.85 },
  kiraExploded: { file: "killerqueen/EXPLODED.mp3", gain: 1.45 },
  battleBgm: { file: "Sound Battle.mp3", gain: 1.0, isBgm: true },
};

let audioCtx = null;
let isMuted = false;
let isSfxMuted = false;
let isBgmMuted = false;
let sfxVolume = 0.3;
let bgmVolume = 0.2;
const audioBuffers = new Map();
const activeVoices = new Set();
let activeBgm = null;

function ensureAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

async function preloadAllSounds() {
  ensureAudioContext();
  if (!audioCtx) return;
  for (const [key, spec] of Object.entries(SOUNDS)) {
    if (audioBuffers.has(key)) continue;
    try {
      const res = await fetch(encodePath(spec.file));
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(buf);
      audioBuffers.set(key, decoded);
    } catch {
      // Fallback to HTMLAudioElement (e.g. file:// protocol)
    }
  }
}

function playSound(key) {
  if (isMuted || isSfxMuted) return null;
  const spec = SOUNDS[key];
  if (!spec || spec.isBgm) return null;

  ensureAudioContext();
  const effectiveGain = spec.gain * sfxVolume;
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

function startBattleBgm() {
  stopBattleBgm();
  if (isMuted || isBgmMuted || bgmVolume <= 0.001) return;
  ensureAudioContext();

  const buffer = audioBuffers.get("battleBgm");
  if (audioCtx && buffer) {
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = bgmVolume;
    src.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    src.start(0);
    activeBgm = { type: "buffer", src, gainNode };
    return;
  }

  const audio = new Audio(encodePath(SOUNDS.battleBgm.file));
  audio.loop = true;
  audio.volume = Math.min(1, bgmVolume);
  audio.play().catch(() => {});
  activeBgm = { type: "html", audio };
}

function updateBgmVolumeLive() {
  const effectiveVol = isMuted || isBgmMuted ? 0 : bgmVolume;
  if (!activeBgm) {
    if (effectiveVol > 0.001 && state && state.running) {
      startBattleBgm();
    }
    return;
  }
  if (activeBgm.type === "buffer" && audioCtx) {
    activeBgm.gainNode.gain.setValueAtTime(effectiveVol, audioCtx.currentTime);
  } else if (activeBgm.audio) {
    activeBgm.audio.volume = Math.min(1, effectiveVol);
  }
}

function stopBattleBgm() {
  if (!activeBgm) return;
  if (activeBgm.type === "buffer") {
    try {
      activeBgm.src.stop();
    } catch {}
  } else if (activeBgm.audio) {
    activeBgm.audio.pause();
    activeBgm.audio.currentTime = 0;
  }
  activeBgm = null;
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
  stopBattleBgm();
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
const aiColHeader = document.getElementById("ai-col-header");
const aiDiffDesc = document.getElementById("ai-diff-desc");
const endOverlay = document.getElementById("end-overlay");
const endTitle = document.getElementById("end-title");
const endSubtitle = document.getElementById("end-subtitle");
const settingsOverlay = document.getElementById("settings-overlay");

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
let lastTime = 0;
let vsTimerHandle = null;
let endTimerHandle = null;
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
    dashTimer: 0,
    dashVx: 0,
    dashVy: 0,
    stunTimer: 0,
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
    skillBtns[k].btn.classList.remove("dio-mode", "kira-mode");
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
  const pool = ["jotaro", "dio", "kira"];
  return pool[Math.floor(Math.random() * pool.length)];
}

function startMatchWithIntro() {
  syncArenaSize();
  preloadAllSounds();
  stopAllSounds();
  if (vsTimerHandle) clearTimeout(vsTimerHandle);
  if (endTimerHandle) clearTimeout(endTimerHandle);

  const p1Char = selectedPlayerChar;
  const p2Char = resolveAiCharacter();

  selectOverlay.classList.add("hidden");
  endOverlay.classList.add("hidden");
  mainMenuOverlay.classList.add("hidden");
  resultBanner.classList.add("hidden");

  const diffCfg = AI_DIFFICULTIES[selectedAiDifficulty] || AI_DIFFICULTIES.hard;
  vsP1Name.textContent = CHAR_CONFIG[p1Char].name;
  vsP2Name.textContent = `${CHAR_CONFIG[p2Char].name} (${diffCfg.label})`;
  vsP1Img.src = encodePath(CHAR_CONFIG[p1Char].imgPath);
  vsP2Img.src = encodePath(CHAR_CONFIG[p2Char].imgPath);
  vsIntroOverlay.classList.remove("hidden");

  initGameState(p1Char, p2Char);
  state.running = false;

  vsTimerHandle = setTimeout(() => {
    vsIntroOverlay.classList.add("hidden");
    if (state && !state.gameOver) {
      state.running = true;
      startBattleBgm();
    }
  }, 1900);
}

function initGameState(p1Char, p2Char) {
  configureHudAndSkillBar(p1Char, p2Char);

  const a1 = Math.random() * Math.PI * 2;
  const a2 = Math.random() * Math.PI * 2;
  const baseSpeed = 180;

  const p1 = createFighter(
    "p1",
    p1Char,
    ARENA_CX - 340,
    ARENA_CY,
    Math.cos(a1) * baseSpeed,
    Math.sin(a1) * baseSpeed
  );

  const p2 = createFighter(
    "p2",
    p2Char,
    ARENA_CX + 340,
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
      p1: { q: 0, e: 0, r: 0, dash: 0 },
      p2: { q: 0, e: 0, r: 0, dash: 0 },
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
    },
    firstBombs: [],
    pendingOhkos: [], // { targetSlot, timer } — waits for explosion VFX before finishing target
    explosions: [],
    barrageClashes: [],
    starFingerBeams: [],
    punches: [],
    particles: [],
    floatingTexts: [],
    screenShake: 0,
    uiSyncTimer: 0,
    dioTauntTimer: 10 + Math.random() * 5,
    aiDecisionTimer: 0.45,
    aiGuardTimer: 0,
    aiStrafeDir: 1,
    aiStrafeSwitchTimer: 1.2,
    aiCombo: null,
  };

  const diffCfg = getActiveAiDiff();
  state.cooldowns.p2.q = diffCfg.startDelayQ;
  state.cooldowns.p2.e = diffCfg.startDelayE;
  state.cooldowns.p2.r = p2Char === "dio" ? Math.max(diffCfg.startDelayR, diffCfg.id === "super" ? 4.5 : 8.5) : diffCfg.startDelayR;

  updateHpUI();
  updateSkillBarUI();
  timestopBanner.classList.add("hidden");
}

// ── Helpers ─────────────────────────────────────────────────
function getFighter(slot) {
  return slot === "p1" ? state.p1 : state.p2;
}

function getOpponent(slot) {
  return slot === "p1" ? state.p2 : state.p1;
}

function isFrozen(slot) {
  return state.timeStop.active && state.timeStop.casterSlot !== slot;
}

function spawnParticles(x, y, color, count = 12, speed = 180) {
  if (state.particles.length >= 110) return;
  const allowed = Math.min(count, 110 - state.particles.length);
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

  if (target.hp <= 0) {
    endGame(target.slot === "p2" ? "p1" : "p2");
  }
}

function endGame(winnerSlot) {
  state.gameOver = true;
  state.running = false;
  state.timeStop.active = false;
  state.p1.timeStopPendingDmg = 0;
  state.p2.timeStopPendingDmg = 0;
  timestopBanner.classList.add("hidden");
  stopBattleBgm();

  const playerWon = winnerSlot === "p1";
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

// ── Dash (Shift, CD 5s) ─────────────────────────────────────
function triggerDash(fighter, dirX = null, dirY = null) {
  if (!state || !state.running) return;
  if (fighter.hidden || isFrozen(fighter.slot) || fighter.biteTheDustCharge > 0 || fighter.stunTimer > 0 || fighter.isChargingTimeStop) return;
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

  state.cooldowns[fighter.slot].dash = DASH_COOLDOWN;
  fighter.dashTimer = 0.16;
  fighter.dashVx = dx * 700;
  fighter.dashVy = dy * 700;
  fighter.vx = dx * 210;
  fighter.vy = dy * 210;

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
  if (caster.hidden || isFrozen(casterSlot) || caster.biteTheDustCharge > 0 || caster.stunTimer > 0 || caster.isChargingTimeStop) return;

  if (key === "t") {
    if (caster.charId !== "kira") return;
    detonateFirstBomb(casterSlot);
    return;
  }

  if (state.cooldowns[casterSlot][key] > 0) return;
  const charModule = CHAR_CONFIG[caster.charId];
  if (key === "q" && caster.charId !== "kira" && charModule.skills.q?.chargeTime > 0) {
    startTimeStopCharge(casterSlot);
    return;
  }

  const cdMax = charModule.skills[key].cd;
  state.cooldowns[casterSlot][key] = cdMax;

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

function startBarrage(caster, barrageCfg) {
  const cfg = barrageCfg || CHAR_CONFIG[caster.charId].barrage;
  const totalPunches = cfg.totalPunches;
  const audioEntry = playSound(cfg.soundKey);

  let totalDuration = 2.15;
  if (audioEntry && Number.isFinite(audioEntry.duration) && audioEntry.duration > 0.6) {
    totalDuration = Math.min(2.6, Math.max(1.4, audioEntry.duration * 0.9));
  }

  caster.barrageQueue = {
    remaining: totalPunches,
    timer: 0,
    interval: totalDuration / totalPunches,
    audioEntry,
  };
  spawnFloatingText(caster.x, caster.y - 84, cfg.callout, cfg.color, 24);
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
  const order = casterSlot ? [getOpponent(casterSlot), getFighter(casterSlot)] : [state.p1, state.p2];
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
      if (f && f.hp <= 0 && !state.gameOver) {
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

function spawnBarragePunch(fighter, opponent, isLastPunch) {
  const baseAngle = Math.atan2(opponent.y - fighter.y, opponent.x - fighter.x);

  const barrageCfg = CHAR_CONFIG[fighter.charId].barrage;
  const punchDmg = isLastPunch ? barrageCfg.lastPunchDamage : barrageCfg.punchDamage;

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
        color: CHAR_CONFIG[fighter.charId].color,
        img: CHAR_CONFIG[fighter.charId].armAsset(),
        life: maxLife,
        maxLife,
        hit: false,
        suspended: false,
        isVisualOnly,
        damage: isVisualOnly ? 0 : punchDmg,
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

  // Guard state & slow regen (max 20 DMG pool, 4s lock when broken, 25s full recharge)
  const wantsGuard =
    f.slot === "p1" ? keysPressed.has("f") || touchInput.guarding : state.aiGuardTimer > 0;
  if (
    wantsGuard &&
    f.guardBrokenTimer <= 0 &&
    f.guardPool > 0.2 &&
    f.biteTheDustCharge <= 0 &&
    f.stunTimer <= 0 &&
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
      const blastRadius = btdCfg.blastRadius || 310;
      playSound("kiraExploded");
      spawnBombExplosion(f.x, f.y, blastRadius, "pink", 11);

      const missingRatio = 1 - f.hp / f.maxHp;
      const btdDmg = Math.round((btdCfg.minDmg || 50) + missingRatio * (btdCfg.maxBonusDmg || 20));
      const healPct = btdCfg.healPct || 0.2;
      const healAmount = f.maxHp * healPct;
      f.hp = Math.min(f.maxHp, f.hp + healAmount);
      spawnFloatingText(f.x, f.y - f.radius - 20, `+${Math.round(healPct * 100)}% HP!`, "#4ade80", 28);
      updateHpUI();

      const opp = getOpponent(f.slot);
      const dist = Math.hypot(opp.x - f.x, opp.y - f.y);
      if (!opp.hidden && dist <= blastRadius + opp.radius * 0.5) {
        applyAttackDamage(f.slot, opp, btdDmg, "#ec4899", true);
      }
    }
    return;
  }

  // Heavy Knockback flight (e.g. DIO Road Roller impact) overrides normal steering briefly
  if (f.knockbackTimer > 0) {
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
  } else if (f.stunTimer > 0) {
    // Stunned (e.g. Star Finger): cannot steer, rapidly decelerates
    const damp = Math.max(0, 1 - dt * 10);
    f.vx *= damp;
    f.vy *= damp;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  } else {
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
        const accel = f.isGuarding ? 460 : 800;
        f.vx += ax * accel * dt;
        f.vy += ay * accel * dt;

        const spd = Math.hypot(f.vx, f.vy);
        const maxSpd = f.isGuarding ? 165 : 250;
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
  const player = state.p1;
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

  if (player.biteTheDustCharge > 0 && dist < 345 && diff.id !== "easy") {
    // Retreat outside Bite The Dust 310px radius
    steerX = -rawNx;
    steerY = -rawNy;
  } else if (
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
      // Smart trapper Kira: position on the opposite side of the floor bomb from the player to lure/pincer them into blast zone!
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
    spawnBarragePunch(fighter, opponent, isLast);
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
          p.hit = true;
          other.hit = true;
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
          if (!p.isVisualOnly && p.damage > 0) {
            applyAttackDamage(p.ownerSlot, target, p.damage, p.color, false);
            spawnParticles(p.x, p.y, p.color, 2, 110);
          }
        }
      }
    }

    const travelDist = Math.hypot(p.x - p.originX, p.y - p.originY);
    if (p.life <= 0 || p.hit || travelDist > 125) {
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
  if (!rr.active || isFrozen(rr.casterSlot)) return;

  const caster = getFighter(rr.casterSlot);

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
      for (const fighter of [state.p1, state.p2]) {
        if (fighter.slot === rr.casterSlot || fighter.hidden) continue;
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
      b.x = t.x;
      b.y = t.y;
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
      applyDamage(target, target.maxHp, "#ef4444", true);
    }
  }
}

function checkSuperAiReflexes(ai, player, cds, dist) {
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

  // 3. Instant Bite The Dust escape dash
  if (player.biteTheDustCharge > 0 && dist < 332 && cds.dash <= 0) {
    triggerDash(ai, ai.x - player.x, ai.y - player.y);
    return true;
  }

  // 4. Smart Barrage defense: guard briefly then dash out BEFORE shield breaks!
  if (player.barrageQueue && dist < 175) {
    if (ai.guardBrokenTimer <= 0 && ai.guardPool > 7) {
      state.aiGuardTimer = 0.22;
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
      if (!player.hidden && bDist <= blastR + player.radius * 0.4) {
        detonateFirstBomb("p2");
        return true;
      }
    }
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
      if (bomb.attachedSlot === "p1" || (!player.hidden && bDist <= blastR + player.radius * 0.5)) {
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
    // Kira Combo 1 (Smart Bomb Trap + Herd/Pressure): Plant floor bomb ahead -> Barrage to corner player into bomb -> Detonate after >= 1s!
    const existingBomb = state.firstBombs.find((b) => b.ownerSlot === "p2");
    if (!existingBomb && cds.r <= 0 && dist >= 100 && dist <= 245 && !player.barrageQueue && !player.hidden) {
      const steps = [
        { type: "skill", key: "r", delay: 0, maxDist: 255 },
      ];
      if (cds.e <= 0 && dist <= 165) {
        steps.push({ type: "skill", key: "e", delay: 0.16, maxDist: 170 });
      } else if (cds.dash <= 0 && dist > 165) {
        steps.push({ type: "dash_in", delay: 0.16, lead: 0.15, minDist: 115 });
      }
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

function updateAI(dt) {
  const ai = state.p2;
  const player = state.p1;
  if (ai.hidden || isFrozen("p2") || ai.biteTheDustCharge > 0 || ai.stunTimer > 0 || ai.isChargingTimeStop) return;

  if (state.aiGuardTimer > 0) {
    state.aiGuardTimer = Math.max(0, state.aiGuardTimer - dt);
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
  const cds = state.cooldowns.p2;

  // Per-frame veteran reflex layer for Super Hard AI (emergency dodges cancel active combo)
  if (diff.id === "super" && checkSuperAiReflexes(ai, player, cds, dist)) {
    if (player.biteTheDustCharge > 0 || (state.roadRoller.active && state.roadRoller.casterSlot === "p1")) {
      state.aiCombo = null;
    }
    return;
  }

  if (diff.id === "super" && runAiCombo(ai, player, cds, dist, dt)) {
    return;
  }

  state.aiDecisionTimer -= dt;
  if (state.aiDecisionTimer > 0) return;
  state.aiDecisionTimer = diff.decisionMin + Math.random() * (diff.decisionMax - diff.decisionMin);

  if (diff.id === "super" && tryStartSuperAiCombo(ai, player, cds, dist)) {
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
    if (player.biteTheDustCharge > 0 && dist < 320 && diff.id !== "easy") {
      triggerDash(ai, ai.x - player.x, ai.y - player.y);
      return;
    }
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
      const detRadius = diff.id === "super" ? 160 : 135;
      if (bomb.attachedSlot || bDist <= detRadius + player.radius * 0.4) {
        detonateFirstBomb("p2");
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
  }
}

function update(dt) {
  if (!state || !state.running) return;

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
  updateBarrageQueue(state.p2, state.p1, dt);
  updatePunches(dt);
  updateStarFinger(dt);
  updateRoadRoller(dt);
  updateFirstBombs(dt);
  updateAI(dt);

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
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  if (state && state.screenShake > 0) {
    const sx = (Math.random() - 0.5) * state.screenShake * 2;
    const sy = (Math.random() - 0.5) * state.screenShake * 2;
    ctx.translate(sx, sy);
  }

  if (state && state.timeStop.active) {
    ctx.filter = "grayscale(70%) contrast(1.12)";
  } else {
    ctx.filter = "none";
  }

  drawJoJoArenaFloor();

  if (!state) {
    ctx.restore();
    return;
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

  if (!state.p2.hidden) drawFighter(state.p2);
  if (!state.p1.hidden) drawFighter(state.p1);

  for (const p of state.punches) {
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
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

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

  ctx.filter = "none";
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

  ctx.restore();
}

function drawJoJoArenaFloor() {
  ctx.save();

  const grad = ctx.createRadialGradient(ARENA_CX, ARENA_CY, 90, ARENA_CX, ARENA_CY, ARENA_W * 0.65);
  grad.addColorStop(0, "#3b2621");
  grad.addColorStop(0.6, "#27171a");
  grad.addColorStop(1, "#160b12");

  ctx.beginPath();
  ctx.roundRect(ARENA_LEFT, ARENA_TOP, ARENA_W, ARENA_H, 22);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(ARENA_LEFT, ARENA_TOP, ARENA_W, ARENA_H, 22);
  ctx.clip();

  ctx.strokeStyle = "rgba(250, 204, 21, 0.08)";
  ctx.lineWidth = 1.5;
  const tileSize = 78;
  for (let x = ARENA_LEFT; x < ARENA_RIGHT; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, ARENA_TOP);
    ctx.lineTo(x, ARENA_BOTTOM);
    ctx.stroke();
  }
  for (let y = ARENA_TOP; y < ARENA_BOTTOM; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(ARENA_LEFT, y);
    ctx.lineTo(ARENA_RIGHT, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(250, 204, 21, 0.14)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ARENA_CX, ARENA_CY, 160, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 110 : 48;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const px = ARENA_CX + Math.cos(a) * r;
    const py = ARENA_CY + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(250, 204, 21, 0.05)";
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(250, 204, 21, 0.07)";
  ctx.font = "900 44px sans-serif";
  ctx.fillText("ゴ", ARENA_LEFT + 32, ARENA_TOP + 64);
  ctx.fillText("ゴ", ARENA_RIGHT - 74, ARENA_BOTTOM - 34);

  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(ARENA_LEFT, ARENA_TOP, ARENA_W, ARENA_H, 22);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#d97706";
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(ARENA_LEFT + 5, ARENA_TOP + 5, ARENA_W - 10, ARENA_H - 10, 18);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(253, 224, 71, 0.45)";
  ctx.stroke();

  ctx.restore();
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
    const pct = 1 - f.biteTheDustCharge / 2.0;
    ctx.strokeStyle = "#ec4899";
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

  if (f.hitFlash > 0) {
    ctx.fillStyle = "rgba(255, 77, 79, 0.28)";
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Normalize all characters by consistent visual height (+ per-character spriteScale)
  const scale = CHAR_CONFIG[f.charId].spriteScale || 1;
  const targetH = f.radius * 2.35 * scale;
  if (f.img && f.img.complete && f.img.naturalWidth > 0) {
    const aspect = f.img.naturalWidth / f.img.naturalHeight;
    let h = targetH;
    let w = targetH * aspect;
    const maxW = f.radius * 2.85 * scale;
    if (w > maxW) {
      w = maxW;
      h = maxW / aspect;
    }
    ctx.scale(f.facing, 1);
    ctx.drawImage(f.img, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = CHAR_CONFIG[f.charId].color;
    ctx.beginPath();
    ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Spinning golden stars halo above stunned enemy's head (Star Finger 0.5s stun)
  if (f.stunTimer > 0) {
    ctx.save();
    ctx.translate(f.x, f.y - f.radius - 26);
    const rot = performance.now() * 0.0085;
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
  const pulse = 1 + Math.sin(performance.now() * 0.018) * 0.15;

  if (bomb.attachedSlot) {
    // Prominent RED ring when attached to enemy!
    const target = getFighter(bomb.attachedSlot);
    ctx.strokeStyle = "#ef4444";
    ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
    ctx.lineWidth = 4.5;
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, (target.radius + 18) * pulse, 0, Math.PI * 2);
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

  ctx.shadowBlur = 0;
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

  // 3. Turbulent Fireball Puffs
  for (const puff of ex.puffs) {
    const pProg = Math.max(0, (progress - puff.delay * 0.5) / 0.75);
    if (pProg <= 0 || pProg >= 1) continue;
    const fireAlpha = Math.max(0, 1 - pProg);
    const px = Math.cos(puff.angle) * puff.dist * easeOut;
    const py = Math.sin(puff.angle) * puff.dist * easeOut;
    const pr = puff.size * (0.4 + pProg * 0.7);

    const grad = ctx.createRadialGradient(px, py, pr * 0.1, px, py, pr);
    grad.addColorStop(0, `rgba(255, 255, 255, ${fireAlpha})`);
    grad.addColorStop(0.45, `${innerFire} ${fireAlpha * 0.95})`);
    grad.addColorStop(1, `${outerFire} 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Central Blinding Core Flash
  if (progress < 0.45) {
    const coreAlpha = Math.max(0, 1 - progress / 0.45);
    const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, curR * 0.75);
    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`);
    coreGrad.addColorStop(0.5, `rgba(254, 240, 138, ${coreAlpha * 0.85})`);
    coreGrad.addColorStop(1, `${outerFire} 0)`);
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, curR * 0.75, 0, Math.PI * 2);
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

  const w = 78 * p.scale;
  const h = 40 * p.scale;

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

  if (p.img && p.img.complete && p.img.naturalWidth > 0) {
    ctx.drawImage(p.img, -w / 2, -h / 2, w, h);
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

  // 2. Central golden-white starburst flash
  ctx.rotate(c.seed + prog * 1.4);
  const spikes = 10;
  const outerR = 30 + prog * 36;
  const innerR = 9 + prog * 8;
  const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, outerR);
  grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
  grad.addColorStop(0.45, `rgba(253, 224, 71, ${alpha * 0.92})`);
  grad.addColorStop(1, `rgba(249, 115, 22, 0)`);

  ctx.fillStyle = grad;
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
  ctx.roundRect(18, -11, 24, 22, 5);
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
  const pulse = 0.85 + Math.sin(performance.now() * 0.018) * 0.15;
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

  const img = ASSETS.roadRoller;
  if (img && img.complete && img.naturalWidth > 0) {
    const drawW = 240;
    const drawH = (drawW * img.naturalHeight) / img.naturalWidth;
    ctx.drawImage(img, -drawW / 2, -drawH / 2 - 20, drawW, drawH);
  } else {
    ctx.fillStyle = "#eab308";
    ctx.fillRect(-90, -60, 180, 90);
  }

  ctx.restore();
}

// ── UI Updates ──────────────────────────────────────────────
function updateHpUI() {
  if (!state) return;
  const p = state.p1;
  const a = state.p2;

  const pPct = Math.max(0, (p.hp / p.maxHp) * 100);
  const aPct = Math.max(0, (a.hp / a.maxHp) * 100);

  p1HpFill.style.width = `${pPct}%`;
  p1HpTrail.style.width = `${pPct}%`;
  p1HpText.textContent = `${p.hp <= 0 ? 0 : Math.max(1, Math.round(pPct))}%`;
  p1GuardFill.style.width = `${(p.guardPool / MAX_GUARD_POOL) * 100}%`;

  p2HpFill.style.width = `${aPct}%`;
  p2HpTrail.style.width = `${aPct}%`;
  p2HpText.textContent = `${a.hp <= 0 ? 0 : Math.max(1, Math.round(aPct))}%`;
  p2GuardFill.style.width = `${(a.guardPool / MAX_GUARD_POOL) * 100}%`;
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
      ui.overlay.style.height = `${(cd / max) * 100}%`;
      ui.text.textContent = txt;
      if (mBtn && mCd) {
        mBtn.classList.add("on-cooldown");
        mCd.textContent = txt;
      }
    } else {
      ui.btn.classList.remove("on-cooldown");
      ui.overlay.style.height = "0%";
      ui.text.textContent = "";
      if (mBtn && mCd) {
        mBtn.classList.remove("on-cooldown");
        mCd.textContent = "";
      }
    }
  }

  const dashCd = cds.dash;
  const mDashBtn = document.getElementById("m-btn-dash");
  const mDashCd = document.getElementById("m-cd-dash");
  if (dashCd > 0) {
    const txt = `${dashCd.toFixed(1)}s`;
    skillBtns.dash.btn.classList.add("on-cooldown");
    skillBtns.dash.overlay.style.height = `${(dashCd / DASH_COOLDOWN) * 100}%`;
    skillBtns.dash.text.textContent = txt;
    if (mDashBtn && mDashCd) {
      mDashBtn.classList.add("on-cooldown");
      mDashCd.textContent = txt;
    }
  } else {
    skillBtns.dash.btn.classList.remove("on-cooldown");
    skillBtns.dash.overlay.style.height = "0%";
    skillBtns.dash.text.textContent = "";
    if (mDashBtn && mDashCd) {
      mDashBtn.classList.remove("on-cooldown");
      mDashCd.textContent = "";
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
      skillBtns.t.text.textContent = txt;
      if (mTBtn && mTCd) {
        mTBtn.classList.remove("on-cooldown");
        mTBtn.classList.add("bomb-ready");
        mTCd.textContent = txt;
      }
    } else {
      skillBtns.t.btn.classList.add("on-cooldown");
      skillBtns.t.btn.classList.remove("bomb-ready");
      skillBtns.t.text.textContent = "";
      if (mTBtn && mTCd) {
        mTBtn.classList.add("on-cooldown");
        mTBtn.classList.remove("bomb-ready");
        mTCd.textContent = "";
      }
    }
  }

  const guardText = p.guardBrokenTimer > 0 ? `Vỡ ${p.guardBrokenTimer.toFixed(1)}s` : "Block";
  const guardNameEl = document.getElementById("guard-desc-f");
  if (guardNameEl) guardNameEl.textContent = guardText;
  guardBtnEl.classList.toggle("guard-active", p.isGuarding);

  const mGuardBtn = document.getElementById("m-btn-f");
  const mGuardSub = document.getElementById("m-guard-sub");
  if (mGuardBtn) mGuardBtn.classList.toggle("guard-active", p.isGuarding);
  if (mGuardSub) mGuardSub.textContent = guardText;
}

// ── Main Loop & Controls ────────────────────────────────────
function gameLoop(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTime) / 1000 || 0);
  lastTime = timestamp;

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
  if (k === "q" && e.repeat) return;
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
});

window.addEventListener("blur", () => {
  keysPressed.clear();
  if (state?.p1?.isChargingTimeStop) {
    cancelTimeStopCharge(state.p1, "HỦY CHIÊU!");
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
skillBtns.e.btn.addEventListener("click", () => state && castSkill("p1", "e"));
skillBtns.r.btn.addEventListener("click", () => state && castSkill("p1", "r"));
skillBtns.t.btn.addEventListener("click", () => state && castSkill("p1", "t"));
skillBtns.dash.btn.addEventListener("click", () => state && triggerDash(state.p1));

// Character & Opponent Select
document.querySelectorAll("#player-char-grid .char-card").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll("#player-char-grid .char-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    selectedPlayerChar = card.dataset.char;
  });
});

document.querySelectorAll("#ai-char-grid .char-card").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll("#ai-char-grid .char-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    selectedAiChar = card.dataset.ai;
  });
});

document.querySelectorAll("#ai-diff-bar .diff-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#ai-diff-bar .diff-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedAiDifficulty = btn.dataset.diff;
    const dCfg = AI_DIFFICULTIES[selectedAiDifficulty] || AI_DIFFICULTIES.hard;
    if (aiColHeader) aiColHeader.textContent = `ĐỐI THỦ (AI ${dCfg.label})`;
    if (aiDiffDesc) aiDiffDesc.textContent = dCfg.desc;
  });
});

// Navigation & Modals
document.getElementById("goto-select-btn").addEventListener("click", () => {
  mainMenuOverlay.classList.add("hidden");
  selectOverlay.classList.remove("hidden");
});

document.getElementById("back-to-menu-btn").addEventListener("click", () => {
  selectOverlay.classList.add("hidden");
  mainMenuOverlay.classList.remove("hidden");
});

document.getElementById("start-btn").addEventListener("click", startMatchWithIntro);
document.getElementById("end-replay-btn").addEventListener("click", startMatchWithIntro);

function returnToMainMenu() {
  if (state) state.running = false;
  if (vsTimerHandle) clearTimeout(vsTimerHandle);
  if (endTimerHandle) clearTimeout(endTimerHandle);
  stopAllSounds();
  vsIntroOverlay.classList.add("hidden");
  resultBanner.classList.add("hidden");
  endOverlay.classList.add("hidden");
  selectOverlay.classList.add("hidden");
  mainMenuOverlay.classList.remove("hidden");
}

document.getElementById("end-menu-btn").addEventListener("click", returnToMainMenu);
menuBtn.addEventListener("click", returnToMainMenu);

// Audio & Settings
muteBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  muteBtn.textContent = isMuted ? "🔇" : "🔊";
  if (isMuted) {
    stopAllSounds();
  } else if (state && state.running) {
    startBattleBgm();
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
}

settingsBtn.addEventListener("click", openSettings);
document.getElementById("menu-settings-btn").addEventListener("click", openSettings);
document.getElementById("close-settings-btn").addEventListener("click", () => {
  settingsOverlay.classList.add("hidden");
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

function isTouchDeviceOrSmallScreen() {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth <= 920
  );
}

function syncMobileControlsVisibility() {
  const show =
    touchMode === "on" || (touchMode === "auto" && isTouchDeviceOrSmallScreen());
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

draw();
lastTime = performance.now();
requestAnimationFrame(gameLoop);
