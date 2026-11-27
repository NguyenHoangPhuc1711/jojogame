// ── DIAVOLO (King Crimson) ──────────────────────────────────
window.JOJO_CHARS = window.JOJO_CHARS || {};

window.JOJO_CHARS.diavolo = {
  id: "diavolo",
  name: "DIAVOLO",
  imgPath: "Diavolo/Diavolo_with_stand.webp",
  armPath: "Diavolo/arm_king_crimson.webp",
  spriteScale: 1.08,
  themeClass: "diavolo-theme",
  fillClass: "diavolo-fill",
  modeClass: "diavolo-mode",
  color: "#ef4444",
  guardAura: "#dc2626",

  skills: {
    q: {
      name: "EPITAPH",
      desc: "CD 25s — Màn hình đỏ 3s; chịu sát thương thì áp sát, bất động 3s và đấm 50 DMG",
      cd: 25,
      duration: 3.0,
      stunDuration: 3.0,
      damage: 50,
      soundKey: "diavoloEpitaph",
      callout: "EPITAPH!",
    },
    e: {
      name: "TIME SKIP",
      desc: "Dịch chuyển; địch sát bên bị đấm và ghim tường (30 DMG, choáng 0.5s)",
      cd: 7,
      distance: 265,
      impactRadius: 42,
      impactDamage: 30,
      wallStunDuration: 0.5,
      soundKey: "diavoloTimeSkip",
      callout: "KING CRIMSON!",
    },
    r: {
      name: "CRIMSON BARRAGE",
      desc: "Giữ R — 35 đấm × 1.0 DMG (35 DMG)",
      cd: 9,
      isBarrage: true,
    },
  },

  barrage: {
    totalPunches: 35,
    punchDamage: 1.0,
    lastPunchDamage: 1.0,
    soundKey: "diavoloBarrage",
    callout: "KING CRIMSON!",
    color: "#ef4444",
  },

  epitaphBarrage: {
    totalPunches: 42,
    punchDamage: 1.2,
    lastPunchDamage: 0.8, // 41 * 1.2 + 0.8 = 50.0 DMG
    soundKey: null,
    callout: "XÓA BỎ THỜI GIAN!",
    color: "#dc2626",
  },

  castSkill(api, casterSlot, caster, opponent, key) {
    if (key === "r") {
      api.startBarrage(caster, this.barrage, "r", this.skills.r.cd);
    } else if (key === "e") {
      api.triggerTimeSkip(caster, opponent, this.skills.e);
    } else if (key === "q") {
      api.activateEpitaph(caster, this.skills.q);
    }
  },
};
