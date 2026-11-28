// ── YOSHIKAGE KIRA (Killer Queen) ───────────────────────────
// Chỉnh sửa thông số kỹ năng, sát thương, hồi chiêu của Kira tại đây.
window.JOJO_CHARS = window.JOJO_CHARS || {};

window.JOJO_CHARS.kira = {
  id: "kira",
  name: "YOSHIKAGE KIRA",
  imgPath: "killerqueen/kira_with_stand.png",
  armPath: "killerqueen/arm_killer_queen.png",
  spriteScale: 1.0,
  themeClass: "kira-theme",
  fillClass: "kira-fill",
  modeClass: "kira-mode",
  color: "#f472b6",
  guardAura: "#ec4899",

  skills: {
    q: {
      name: "BITE THE DUST",
      desc: "Tụ lực 1.5s — Hồi 30% máu",
      cd: 45,
      chargeTime: 1.5,
      healPct: 0.3,
      soundKey: "kiraBiteTheDust",
      callout: "BITES ZA DUSTO...",
    },
    e: {
      name: "KILLER BARRAGE",
      desc: "Giữ E — 34 đấm × 0.9 DMG (30 DMG)",
      cd: 7,
      isBarrage: true,
    },
    r: {
      name: "FIRST BOMB",
      desc: "Bom 8s (30) / Chạm = OHKO",
      cd: 8,
      bombDuration: 8,
      groundDamage: 30,
      groundBlastRadius: 180,
      ohkoBlastRadius: 210,
      soundKey: "kiraDetonate",
    },
  },

  barrage: {
    totalPunches: 34,
    punchDamage: 0.9,
    lastPunchDamage: 0.3, // 33 * 0.9 + 0.3 = 30.0 DMG
    soundKey: "kiraBarrage",
    callout: "SHIBABABA!",
    color: "#f472b6",
  },

  castSkill(api, casterSlot, caster, opponent, key) {
    if (key === "e") {
      api.startBarrage(caster, this.barrage, "e", this.skills.e.cd);
    } else if (key === "r") {
      api.plantFirstBomb(caster, opponent, this.skills.r);
    } else if (key === "q") {
      const q = this.skills.q;
      api.playSound(q.soundKey);
      caster.biteTheDustCharge = q.chargeTime;
      caster.biteTheDustChargeDuration = q.chargeTime;
      caster.vx *= 0.2;
      caster.vy *= 0.2;
      api.spawnFloatingText(caster.x, caster.y - 92, q.callout, this.color, 25);
    }
  },
};
