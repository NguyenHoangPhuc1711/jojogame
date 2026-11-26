// ── JOTARO KUJO (Star Platinum) ─────────────────────────────
// Chỉnh sửa thông số kỹ năng, sát thương, hồi chiêu của Jotaro tại đây.
window.JOJO_CHARS = window.JOJO_CHARS || {};

window.JOJO_CHARS.jotaro = {
  id: "jotaro",
  name: "JOTARO KUJO",
  imgPath: "Jotaro/Jotaro_with_stand.png",
  armPath: "Jotaro/arm_star_platinum.png",
  spriteScale: 1.24,
  themeClass: "jotaro-theme",
  fillClass: "jotaro-fill",
  modeClass: "",
  color: "#c084fc",
  guardAura: "#a855f7",

  skills: {
    q: {
      name: "ZA WARUDO",
      desc: "Giữ 1s — Ngưng đọng 5s",
      cd: 40,
      chargeTime: 1.0,
      duration: 5,
      soundKey: "jotaroZaWarudo",
      callout: "STAR PLATINUM: ZA WARUDO!",
    },
    e: {
      name: "STAR FINGER",
      desc: "Chọc 2 ngón tay tím + Choáng 0.5s (15 DMG)",
      cd: 7,
      damage: 15,
      stunDuration: 0.5,
      maxLength: 230,
      life: 0.36,
      soundKey: "jotaroStarFinger",
      callout: "STAR FINGER!",
    },
    r: {
      name: "ORA BARRAGE",
      desc: "Giữ R — 38 đấm × 1.2 DMG (45 DMG)",
      cd: 8,
      isBarrage: true,
    },
  },

  barrage: {
    totalPunches: 38,
    punchDamage: 1.2,
    lastPunchDamage: 0.6, // 37 * 1.2 + 0.6 = 45.0 DMG
    soundKey: "jotaroBarrage",
    callout: "ORA ORA ORA!",
    color: "#c084fc",
  },

  castSkill(api, casterSlot, caster, opponent, key) {
    if (key === "q") {
      const q = this.skills.q;
      api.activateTimeStop(casterSlot, q.duration);
      api.playSound(q.soundKey);
      api.spawnFloatingText(caster.x, caster.y - 88, q.callout, this.color, 24);
    } else if (key === "e") {
      const e = this.skills.e;
      const leadT = Math.min(0.25, Math.hypot(opponent.x - caster.x, opponent.y - caster.y) / 1400);
      const aimX = opponent.x + opponent.vx * leadT;
      const aimY = opponent.y + opponent.vy * leadT;
      const angle = Math.atan2(aimY - caster.y, aimX - caster.x);

      api.playSound(e.soundKey);
      api.state.starFingerBeams.push({
        casterSlot,
        x1: caster.x,
        y1: caster.y,
        angle,
        length: 30,
        maxLength: e.maxLength,
        life: e.life,
        maxLife: e.life,
        damage: e.damage,
        stunDuration: e.stunDuration || 0.5,
        hitDone: false,
      });
      api.spawnFloatingText(caster.x, caster.y - 84, e.callout, "#d8b4fe", 22);
    } else if (key === "r") {
      api.startBarrage(caster, this.barrage, "r", this.skills.r.cd);
    }
  },
};
