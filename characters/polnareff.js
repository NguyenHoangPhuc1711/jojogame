// ── JEAN PIERRE POLNAREFF (Silver Chariot) ───────────────────
window.JOJO_CHARS = window.JOJO_CHARS || {};

window.JOJO_CHARS.polnareff = {
  id: "polnareff",
  name: "POLNAREFF",
  imgPath: "Polnareff/Polnareff_with_stand.webp",
  armorOffImgPath: "Polnareff/Polnareff_with_stand (Silver Chariot Armor Off).webp",
  armPath: "Polnareff/arm_silver_chariot.webp",
  swordProjPath: "Polnareff/projectile_sword.webp",
  spriteScale: 1.08,
  themeClass: "polnareff-theme",
  fillClass: "polnareff-fill",
  modeClass: "polnareff-mode",
  color: "#e2e8f0",
  guardAura: "#cbd5e1",

  skills: {
    q: {
      name: "ARMOR OFF",
      desc: "15s: 2 phân thân hỗ trợ + x1.5 Tốc + Dash 2s",
      cd: 40,
      duration: 15,
      speedMult: 1.5,
      dashCd: 2.0,
      soundKey: "polnareffSkillQ",
      callout: "ARMOR OFF!",
    },
    e: {
      name: "CHARIOT BARRAGE",
      desc: "Giữ E — 34 nhát kiếm × 0.9 DMG (30 DMG)",
      cd: 8,
      isBarrage: true,
    },
    r: {
      name: "SWORD SHOT",
      desc: "Phóng lưỡi kiếm (15 DMG)",
      cd: 10,
      damage: 15,
      speed: 480,
      projectileSize: 155,
      soundKey: "polnareffSkillR",
      callout: "SILVER CHARIOT!",
    },
  },

  barrage: {
    totalPunches: 34,
    punchDamage: 0.9,
    lastPunchDamage: 0.3, // 33 * 0.9 + 0.3 = 30.0 DMG
    soundKey: "polnareffBarrage",
    callout: "HORA HORA HORA!",
    color: "#e2e8f0",
    isFanSword: true,
  },

  castSkill(api, casterSlot, caster, opponent, key) {
    if (key === "e") {
      api.startBarrage(caster, this.barrage, "e", this.skills.e.cd);
      api.triggerCloneSkill(caster, opponent, "e");
    } else if (key === "r") {
      api.castPolnareffSword(caster, opponent, this.skills.r, false);
      api.triggerCloneSkill(caster, opponent, "r");
    } else if (key === "q") {
      api.activatePolnareffArmorOff(caster, this.skills.q);
    }
  },
};
