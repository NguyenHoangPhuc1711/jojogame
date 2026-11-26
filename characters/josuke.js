// ── JOSUKE HIGASHIKATA (Crazy Diamond) ──────────────────────
window.JOJO_CHARS = window.JOJO_CHARS || {};

window.JOJO_CHARS.josuke = {
  id: "josuke",
  name: "JOSUKE",
  imgPath: "Josuke/Josuke_with_stand.webp",
  armPath: "Josuke/Arm_crazydiamond.webp",
  rockPath: "Josuke/rock_throw.webp",
  angeloPath: "Josuke/Angelo_stone.webp",
  spriteScale: 1.08,
  themeClass: "josuke-theme",
  fillClass: "josuke-fill",
  modeClass: "josuke-mode",
  color: "#f472b6",
  guardAura: "#38bdf8",

  skills: {
    q: {
      name: "ANGELO STONE",
      desc: "Phong ấn 2s thành đá Angelo (35 DMG)",
      cd: 25,
      damage: 35,
      sealDuration: 2.0,
      maxRange: 255,
      soundKey: "josukeSkillQ",
      callout: "YO, ANGELO!",
    },
    e: {
      name: "DORARA BARRAGE",
      desc: "Giữ E — 35 đấm × 1.0 DMG (35 DMG)",
      cd: 9,
      isBarrage: true,
    },
    r: {
      name: "ROCK RETURN",
      desc: "Đập đất nứt + Kéo địch bằng tảng đá (15 DMG)",
      cd: 15,
      damage: 15,
      maxRange: 340,
      soundKey: "josukeSkillR",
      callout: "CRAZY DIAMOND!",
    },
  },

  barrage: {
    totalPunches: 35,
    punchDamage: 1.0,
    lastPunchDamage: 1.0,
    soundKey: "josukeBarrage",
    callout: "DORARARARARA!",
    color: "#f472b6",
  },

  castSkill(api, casterSlot, caster, opponent, key) {
    if (key === "e") {
      api.startBarrage(caster, this.barrage, "e", this.skills.e.cd);
    } else if (key === "r") {
      api.castJosukeRock(caster, opponent, this.skills.r);
    } else if (key === "q") {
      api.castJosukeAngelo(caster, opponent, this.skills.q);
    }
  },
};
