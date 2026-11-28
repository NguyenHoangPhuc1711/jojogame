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
      desc: "Giữ Q — 40 đòn × 1 DMG; trúng đòn biến thành Angelo 2s, cú cuối đẩy lùi",
      cd: 18,
      isBarrage: true,
      sealDuration: 2.0,
      maxRange: 255,
      soundKey: "josukeSkillQ",
      callout: "YO, ANGELO!",
      barrage: {
        totalPunches: 40,
        punchDamage: 1,
        lastPunchDamage: 1,
        soundKey: "josukeBarrage",
        callout: "DORARARARA!",
        color: "#f472b6",
        finalProjectile: "angelo-knockback",
      },
    },
    e: {
      name: "DORARA BARRAGE",
      desc: "Giữ E — 35 đấm × 1.0 DMG (35 DMG)",
      cd: 8,
      isBarrage: true,
    },
    r: {
      name: "ROCK RETURN",
      desc: "Đập đất nứt + Kéo địch bằng tảng đá (15 DMG)",
      cd: 15,
      damage: 15,
      maxRange: 340,
      speed: 430,
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
      api.startBarrage(caster, this.skills.q.barrage, "q", this.skills.q.cd);
    }
  },
};
