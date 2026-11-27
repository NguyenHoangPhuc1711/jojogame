// ── JOLYNE CUJOH (Stone Free) ───────────────────────────────
window.JOJO_CHARS = window.JOJO_CHARS || {};

window.JOJO_CHARS.jolyne = {
  id: "jolyne",
  name: "JOLYNE",
  imgPath: "Jolyne/Jolyne_with_stand.webp",
  skillQImgPath: "Jolyne/Jolyne_skillQ.webp",
  armPath: "Jolyne/Arm_stonefree.webp",
  webPath: "Jolyne/spider_web.webp",
  spriteScale: 1.08,
  themeClass: "jolyne-theme",
  fillClass: "jolyne-fill",
  modeClass: "jolyne-mode",
  color: "#22d3ee",
  guardAura: "#06b6d4",

  skills: {
    q: {
      name: "MOBIUS WEB",
      desc: "Bắn tơ 2s — Trói & Liên hoàn đấm (40 DMG)",
      cd: 18,
      damage: 40,
      webDuration: 2.0,
      webRadius: 88,
      range: 125,
      projectileSpeed: 546,
      soundKey: "jolyneSkillQHit",
      callout: "STONE FREE: MOBIUS!",
    },
    e: {
      name: "ORA BARRAGE",
      desc: "Giữ E — 35 đấm × 1.0 DMG (35 DMG)",
      cd: 9,
      isBarrage: true,
    },
    r: {
      name: "STRING FINGER",
      desc: "Tơ trói, xoay một vòng rồi đập địch về chỗ cũ (25 DMG)",
      cd: 15,
      damage: 25,
      maxLength: 330,
      life: 0.56,
      stunDuration: 1.35,
      soundKey: "jolyneSkillR",
      callout: "STONE FREE!",
    },
  },

  barrage: {
    totalPunches: 35,
    punchDamage: 1.0,
    lastPunchDamage: 1.0,
    soundKey: "jolyneBarrage",
    callout: "ORA ORA ORA!",
    color: "#22d3ee",
  },

  castSkill(api, casterSlot, caster, opponent, key) {
    if (key === "e") {
      api.startBarrage(caster, this.barrage, "e", this.skills.e.cd);
    } else if (key === "r") {
      api.castJolyneStringFinger(caster, opponent, this.skills.r);
    } else if (key === "q") {
      api.castJolyneMobiusWeb(caster, opponent, this.skills.q);
    }
  },
};
