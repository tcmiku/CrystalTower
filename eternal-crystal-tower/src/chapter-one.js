// First-chapter combat rules. Values are deliberately bounded to keep chain
// reactions and encounter summons predictable at high enemy counts.
export const SECTOR_NAMES = ["北", "东北", "东南", "南", "西南", "西北"];
export const sectorAngle = (sector) => -Math.PI / 2 + sector * Math.PI / 3;

export const FORMATIONS = Object.freeze({
  wall: { name: "盾墙推进", hint: "前排保护后排；穿透重炮或无人机绕后", types: ["brute", "brute", "hexer", "wisp"], countMultiplier: 0.75 },
  pincer: { name: "双翼夹击", hint: "两侧高速包夹；环刃守近圈，留星落救场", types: ["runner", "crawler", "runner"], countMultiplier: 0.9 },
  brood: { name: "母巢迁徙", hint: "母巢每 6 秒孵化，最多 4 次；击破停止增援", types: ["sentinel", "wisp", "crawler"], countMultiplier: 0.6 },
  battery: { name: "蓄能炮阵", hint: "炮阵接近后同步蓄能；先集火或用定向护盾迎击", types: ["hexer", "orbitMote", "runner"], countMultiplier: 0.6 }
});
export const REACTIONS = Object.freeze({
  melt: { name: "融爆", radius: 115, damage: 1.8 },
  shatter: { name: "碎晶", radius: 165, targets: 3, damage: 0.65, duration: 4, vulnerability: 1.3 },
  conduct: { name: "超导", radius: 190, targets: 3, duration: 3, share: 0.3 }
});
export const WEAKPOINTS = Object.freeze({
  chain: { name: "共鸣锁链", hint: "近身击破：反噬首领命核", radius: 96, angle: -Math.PI / 2, color: "#b6f58a" },
  relay: { name: "供能节点", hint: "远程击破：首领停火 3 秒", radius: 300, angle: -Math.PI / 4, color: "#ffd578" },
  armor: { name: "外壳接点", hint: "击破：首领承伤 +30%，持续 5 秒", radius: 205, angle: -Math.PI * 3 / 4, color: "#91ddff" }
});
export const WEAKPOINT_RULES = Object.freeze({ interval: 18, hpFraction: 0.025, feedbackFraction: 0.06, stun: 3, expose: 5 });
