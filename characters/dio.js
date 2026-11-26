// ── DIO BRANDO (The World) ──────────────────────────────────
// Chỉnh sửa thông số kỹ năng, sát thương, hồi chiêu của DIO tại đây.
window.JOJO_CHARS = window.JOJO_CHARS || {};

window.JOJO_CHARS.dio = {
  id: "dio",
  name: "DIO BRANDO",
  imgPath: "Dio/dio_with_stand.png",
  armPath: "Dio/arm_the_world.png",
  spriteScale: 1.0,
  themeClass: "dio-theme",
  fillClass: "dio-fill",
  modeClass: "dio-mode",
  color: "#fde047",
  guardAura: "#facc15",

  skills: {
    q: {
      name: "ZA WARUDO",
      desc: "Giữ 1s — Ngưng đọng 6s",
      cd: 35,
      chargeTime: 1.0,
      duration: 6,
      soundKey: "dioTimeStop",
      callout: "ZA WARUDO!",
    },
    e: {
      name: "MUDA BARRAGE",
      desc: "35 đấm × 1.0 DMG (35 DMG)",
      cd: 10,
    },
    r: {
      name: "ROAD ROLLER DA!",
      desc: "Xe lu đè (40 DMG)",
      cd: 40,
      damage: 40,
      aimTimer: 1.25,
      impactRadius: 175,
      soundKey: "dioRoadRoller",
      callout: "ROAD ROLLER DA!!!",
    },
  },

  barrage: {
    totalPunches: 35,
    punchDamage: 1.0,
    lastPunchDamage: 1.0, // 35 * 1.0 = 35.0 DMG
    soundKey: "dioBarrage",
    callout: "MUDA MUDA MUDA!",
    color: "#fde047",
  },

  castSkill(api, casterSlot, caster, opponent, key) {
    if (key === "q") {
      const q = this.skills.q;
      api.activateTimeStop(casterSlot, q.duration);
      api.playSound(q.soundKey);
      api.spawnFloatingText(caster.x, caster.y - 88, q.callout, this.color, 26);
    } else if (key === "e") {
      api.startBarrage(caster, this.barrage);
    } else if (key === "r") {
      const r = this.skills.r;
      api.playSound(r.soundKey);
      caster.hidden = true;
      if (caster.barrageQueue) {
        api.fadeOutAndStopAudio(caster.barrageQueue.audioEntry);
        caster.barrageQueue = null;
      }
      api.state.roadRoller = {
        active: true,
        casterSlot,
        phase: "aim",
        timer: r.aimTimer,
        targetX: opponent.x,
        targetY: opponent.y,
        dropY: -260,
        impactRadius: r.impactRadius,
        damage: r.damage,
      };
      api.spawnFloatingText(caster.x, caster.y - 88, r.callout, "#facc15", 28);
    }
  },
};
