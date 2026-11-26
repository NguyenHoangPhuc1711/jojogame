// ── OKUYASU NIJIMURA (The Hand) ─────────────────────────────
window.JOJO_CHARS = window.JOJO_CHARS || {};

window.JOJO_CHARS.okuyasu = {
  id: "okuyasu",
  name: "OKUYASU",
  imgPath: "The hand/Okuyasu_with_stand.webp",
  armPath: "The hand/arm_the_hand.webp",
  eraseVfxPath: "The hand/the_hand_erase_vfx.webp",
  spriteScale: 1.08,
  themeClass: "okuyasu-theme",
  fillClass: "okuyasu-fill",
  modeClass: "okuyasu-mode",
  color: "#38bdf8",
  guardAura: "#0ea5e9",

  skills: {
    q: {
      name: "SPACE ERASE",
      desc: "Quẹt 3 lần cách nhau 0.3s + Choáng 0.3s",
      cd: 20,
      swipes: 3,
      interval: 0.3,
      damagePerSwipe: 17,
      lastSwipeDamage: 16, // 17 + 17 + 16 = 50 DMG
      stunDuration: 0.3,
      range: 205,
      soundKey: "okuyasuNoise",
      callout: "ZA HANDO GA KESU!",
    },
    e: {
      name: "BRING TO ME",
      desc: "Quẹt không gian kéo địch lại gần (né được)",
      cd: 15,
      range: 210, // ~1.5x barrage range
      damage: 10,
      soundKey: "okuyasuSkillE",
      callout: "LẠI ĐÂY NÀO!",
    },
    r: {
      name: "THE HAND BARRAGE",
      desc: "Giữ R — 34 đấm × 0.9 DMG (30 DMG)",
      cd: 8,
      isBarrage: true,
    },
  },

  barrage: {
    totalPunches: 34,
    punchDamage: 0.9,
    lastPunchDamage: 0.3, // 33 * 0.9 + 0.3 = 30.0 DMG
    soundKey: "okuyasuBarrage",
    callout: "THE HAND!",
    color: "#38bdf8",
  },

  castSkill(api, casterSlot, caster, opponent, key) {
    if (key === "r") {
      api.startBarrage(caster, this.barrage, "r", this.skills.r.cd);
    } else if (key === "e") {
      api.castTheHandPull(caster, opponent, this.skills.e);
    } else if (key === "q") {
      api.castTheHandSpaceErase(caster, opponent, this.skills.q);
    }
  },
};
