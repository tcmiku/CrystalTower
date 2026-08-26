import { GAME_CONFIG } from "./config.js";
import { getDroneDetonateRecovery, getDroneEnergyMax, getDroneGuardShieldMax, getDronePosition, getTowerStats } from "./engine.js";

const ENEMY_COLORS = {
  wisp: ["#ff706d", "#8e273e"],
  runner: ["#ffae68", "#a23b38"],
  brute: ["#ff8166", "#632846"],
  crawler: ["#ff5f68", "#5d1738"],
  sentinel: ["#ff9a63", "#4b203c"],
  hexer: ["#c28cff", "#4d286f"],
  rammer: ["#ffc95d", "#6b3429"],
  boss: ["#ffd078", "#6f1f4b"],
  colossus: ["#ff5b72", "#251136"],
  anchor: ["#d9c8ff", "#38255d"]
};
const ANCHOR_VISUALS = {
  shield: { name: "护盾", color: "#78e9ff", dark: "#1f6688", symbol: "⬡" },
  repair: { name: "修复", color: "#79ffad", dark: "#22684b", symbol: "+" },
  summon: { name: "召唤", color: "#d39aff", dark: "#623782", symbol: "△" },
  overload: { name: "过载", color: "#ff9b59", dark: "#8a3b31", symbol: "ϟ" }
};
const COLOSSUS_SKILLS = {
  artillery: { name: "陨晶炮击", color: "#ff824d" },
  summon: { name: "裂隙召唤", color: "#d67cff" },
  beam: { name: "噬光射线", color: "#ff477c" },
  bulwark: { name: "环界堡垒", color: "#ffd06c" }
};
const COLOSSUS_AFFIXES = {
  siege: { name: "灾厄炮膛", color: "#ff8a4d" },
  brood: { name: "裂殖母巢", color: "#d97cff" },
  prism: { name: "噬光棱镜", color: "#ff4f9a" },
  carapace: { name: "不灭甲壳", color: "#ffd36b" }
};

const GENERATED_ASSETS = {
  arena: "./assets/generated/arena-bg.png",
  arenaDay: "./assets/generated/arena-day.png",
  tower: "./assets/generated/tower-atlas.png",
  towerUltimate: "./assets/generated/tower-ultimate-ai.png",
  enemies: "./assets/generated/enemy-atlas.png",
  waveEnemies: "./assets/generated/enemy-wave-atlas.png",
  boss: "./assets/generated/boss-overlord.png",
  colossus: "./assets/generated/boss-void-ring-colossus.png",
  bossProjectile: "./assets/generated/boss-corruption-lance-ai.png",
  saw: "./assets/generated/crystal-saw.png",
  projectileFrost: "./assets/generated/projectile-frost-ai-v2.png",
  projectileFire: "./assets/generated/projectile-fire-ai.png",
  projectileLightning: "./assets/generated/projectile-lightning-ai-v2.png",
  moduleFrost: "./assets/generated/module-frost-cannon-ai.png",
  moduleFire: "./assets/generated/module-fire-core-ai.png",
  moduleLightning: "./assets/generated/module-lightning-orb-ai.png",
  effectFrost: "./assets/generated/effect-frost-hex-ai.png",
  effectFire: "./assets/generated/effect-fire-ember-ring-ai.png",
  effectLightning: "./assets/generated/effect-lightning-chain-ai.png",
  echoShard: "./assets/generated/resource-echo-shard-ai.png",
  coreFragment: "./assets/generated/resource-core-fragment-ai.png"
};

const CUTOUT_ASSETS = new Set([
  "projectileFrost", "projectileLightning", "moduleFrost", "towerUltimate",
  "effectFrost", "effectFire", "effectLightning"
]);

function removeConnectedLightBackground(image, clearCenter = false) {
  if (typeof document === "undefined") return image;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = frame.data;
  const visited = new Uint8Array(canvas.width * canvas.height);
  const queue = [];
  const isBackground = (pixel) => {
    const offset = pixel * 4;
    const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
    return pixels[offset + 3] > 0 && Math.min(r, g, b) > 224 && Math.max(r, g, b) - Math.min(r, g, b) < 14;
  };
  const enqueue = (pixel) => { if (!visited[pixel] && isBackground(pixel)) { visited[pixel] = 1; queue.push(pixel); } };
  for (let x = 0; x < canvas.width; x += 1) { enqueue(x); enqueue((canvas.height - 1) * canvas.width + x); }
  for (let y = 0; y < canvas.height; y += 1) { enqueue(y * canvas.width); enqueue(y * canvas.width + canvas.width - 1); }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixel = queue[cursor];
    const x = pixel % canvas.width;
    const y = Math.floor(pixel / canvas.width);
    pixels[pixel * 4 + 3] = 0;
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < canvas.width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - canvas.width);
    if (y + 1 < canvas.height) enqueue(pixel + canvas.width);
  }
  ctx.putImageData(frame, 0, 0);
  if (clearCenter) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * .235, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return canvas;
}

function loadGeneratedAssets(onProgress = () => {}) {
  if (typeof Image === "undefined") return { assets: {}, ready: Promise.resolve([]) };
  const entries = Object.entries(GENERATED_ASSETS);
  const assets = {};
  let completed = 0;
  let failed = 0;
  const promises = entries.map(([key, src]) => new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    if (CUTOUT_ASSETS.has(key)) {
      image.addEventListener("load", () => {
        image.cutout = removeConnectedLightBackground(image, key === "effectFrost" || key === "effectFire");
      }, { once: true });
    }
    const settle = (ok) => {
      completed += 1;
      if (!ok) failed += 1;
      onProgress({ completed, total: entries.length, failed });
      resolve({ key, ok });
    };
    image.addEventListener("load", () => settle(true), { once: true });
    image.addEventListener("error", () => settle(false), { once: true });
    image.src = src;
    assets[key] = image;
  }));
  return { assets, ready: Promise.all(promises) };
}

function imageReady(image) {
  return Boolean(image?.complete && image.naturalWidth > 0);
}

export class Renderer {
  constructor(canvas, onAssetProgress) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.shake = 0;
    this.flash = 0;
    this.flashColor = "#ffffff";
    this.time = 0;
    this.dayMix = 1;
    const loading = loadGeneratedAssets(onAssetProgress);
    this.assets = loading.assets;
    this.assetsReady = loading.ready;
    this.stars = Array.from({ length: 74 }, (_, index) => ({
      x: (index * 137.31) % GAME_CONFIG.arena.width,
      y: (index * 83.77) % GAME_CONFIG.arena.height,
      size: 0.5 + (index % 4) * 0.35,
      phase: index * 0.71
    }));
  }

  whenAssetsReady() {
    return this.assetsReady;
  }

  trigger(type, strength = 1) {
    if (type === "towerHit") { this.shake = Math.max(this.shake, 3.5 * strength); this.flash = Math.max(this.flash, 0.09); this.flashColor = "#ff4f70"; }
    if (type === "ascend") { this.shake = 7; this.flash = 0.42; this.flashColor = "#9ff8ff"; }
    if (type === "starfall") { this.shake = 9; this.flash = 0.48; this.flashColor = "#fff2b8"; }
    if (type === "overloadRelease") { this.shake = Math.max(this.shake, 6 * strength); this.flash = Math.max(this.flash, .22 * strength); this.flashColor = strength > 1 ? "#ff704d" : "#d6b0ff"; }
    if (type === "shieldBurst") { this.shake = Math.max(this.shake, 7); this.flash = Math.max(this.flash, .28); this.flashColor = "#bafaff"; }
    if (type === "anchorLocked") { this.flash = Math.max(this.flash, .1); this.flashColor = "#fff0a8"; }
    if (type === "coinVacuum") { this.shake = Math.max(this.shake, 3); this.flash = Math.max(this.flash, .22); this.flashColor = "#ffe68a"; }
    if (type === "bossSpawn") { this.shake = 8; this.flash = 0.25; this.flashColor = "#ff6b72"; }
    if (type === "eliteSpawn") { this.shake = Math.max(this.shake, 4); this.flash = Math.max(this.flash, 0.14); this.flashColor = "#ffd35f"; }
    if (type === "collectPulse") { this.flash = Math.max(this.flash, 0.08); this.flashColor = "#ffe09a"; }
    if (type === "targetProtocol") { this.flash = Math.max(this.flash, 0.06); this.flashColor = "#7ceeff"; }
    if (type === "droneDepleted") { this.flash = Math.max(this.flash, 0.13); this.flashColor = "#ff8a5c"; }
    if (type === "droneIntercept") { this.shake = Math.max(this.shake, 4); this.flash = Math.max(this.flash, 0.18); this.flashColor = "#a8f8ff"; }
    if (type === "droneDetonate") { this.shake = Math.max(this.shake, 8); this.flash = Math.max(this.flash, 0.32); this.flashColor = "#ff8468"; }
    if (type === "droneGuardDepleted") { this.flash = Math.max(this.flash, 0.16); this.flashColor = "#b39aff"; }
    if (type === "eliteMarked") { this.flash = Math.max(this.flash, 0.07); this.flashColor = "#ff6fcf"; }
    if (type === "waveWarning") { this.shake = 3; this.flash = 0.12; this.flashColor = "#ff796f"; }
    if (type === "waveStart") { this.shake = 10; this.flash = 0.34; this.flashColor = "#ff4f70"; }
    if (type === "gameOver") { this.shake = 12; this.flash = 0.55; this.flashColor = "#8a143d"; }
  }

  resize() {
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    return dpr;
  }

  render(state, delta = 1 / 60) {
    const dpr = this.resize();
    const ctx = this.ctx;
    const logical = GAME_CONFIG.arena;
    const cssWidth = this.canvas.width / dpr;
    const cssHeight = this.canvas.height / dpr;
    const scale = Math.min(cssWidth / logical.width, cssHeight / logical.height);
    const offsetX = (cssWidth - logical.width * scale) / 2;
    const offsetY = (cssHeight - logical.height * scale) / 2;
    this.time += delta;
    const targetDayMix = state.phase === "day" ? 1 : 0;
    this.dayMix += (targetDayMix - this.dayMix) * Math.min(1, delta * 0.42);
    this.shake = Math.max(0, this.shake - delta * 16);
    this.flash = Math.max(0, this.flash - delta * 1.7);
    const shakeX = this.shake ? Math.sin(this.time * 77) * this.shake : 0;
    const shakeY = this.shake ? Math.cos(this.time * 61) * this.shake * 0.7 : 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#050612";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.save();
    ctx.translate(offsetX + shakeX, offsetY + shakeY);
    ctx.scale(scale, scale);
    this.drawWorld(ctx, state);
    ctx.restore();

    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.32, this.flash * 0.65);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      ctx.globalAlpha = 1;
    }
  }

  drawWorld(ctx, state) {
    const { width, height, centerX, centerY } = GAME_CONFIG.arena;
    if (imageReady(this.assets.arena) && imageReady(this.assets.arenaDay)) {
      ctx.drawImage(this.assets.arena, 0, 0, width, height);
      ctx.globalAlpha = this.dayMix;
      ctx.drawImage(this.assets.arenaDay, 0, 0, width, height);
      ctx.globalAlpha = 1;
      ctx.fillStyle = state.skills.overload.active > 0 ? "rgba(21,7,56,.34)" : `rgba(3,5,20,${0.25 + (1 - this.dayMix) * 0.23})`;
      ctx.fillRect(0, 0, width, height);
    } else {
      const background = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, 590);
      background.addColorStop(0, state.skills.overload.active > 0 ? "#21114e" : "#151039");
      background.addColorStop(0.48, "#0b0c25");
      background.addColorStop(1, "#050612");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }

    this.drawGround(ctx, state);
    this.drawWaveWarning(ctx, state);
    this.drawRange(ctx, state);
    this.drawEmberZones(ctx, state);
    this.drawRelicDecoys(ctx, state);
    this.drawCoins(ctx, state);
    this.drawPermanentResources(ctx, state);
    this.drawSummonRifts(ctx, state);
    this.drawProjectiles(ctx, state);
    this.drawHostileProjectiles(ctx, state);
    this.drawElementFx(ctx, state);
    this.drawEnemies(ctx, state);
    this.drawSaws(ctx, state);
    this.drawDrones(ctx, state);
    this.drawTower(ctx, state);
    this.drawParticles(ctx, state);
    this.drawFloaters(ctx, state);
    this.drawBossBar(ctx, state);
    this.drawVignette(ctx, state);
  }

  drawGround(ctx, state) {
    const { width, height, centerX, centerY } = GAME_CONFIG.arena;
    ctx.save();
    for (const star of this.stars) {
      const pulse = 0.35 + Math.sin(this.time * 0.9 + star.phase) * 0.2;
      ctx.globalAlpha = pulse * (1 - this.dayMix * 0.82);
      ctx.fillStyle = "#968be8";
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.translate(centerX, centerY);
    ctx.strokeStyle = "rgba(135,118,230,.11)";
    ctx.lineWidth = 1;
    for (const radius of [108, 220, 340, 455]) {
      ctx.setLineDash([3 + radius / 80, 13]);
      ctx.lineDashOffset = this.time * (radius % 2 ? 4 : -4);
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.rotate(this.time * 0.015);
    for (let i = 0; i < 12; i += 1) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath(); ctx.moveTo(235, 0); ctx.lineTo(300, 0); ctx.stroke();
      ctx.fillStyle = "rgba(145,120,255,.13)";
      ctx.fillRect(306, -2, 9, 4);
    }
    ctx.restore();

    if (state.skills.coinVacuum.active > 0) {
      const config = GAME_CONFIG.skills.coinVacuum;
      const progress = 1 - state.skills.coinVacuum.active / config.activeDuration;
      const ease = 1 - (1 - progress) ** 3;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - progress * .72); ctx.strokeStyle = "#ffe37a"; ctx.fillStyle = "#fff2a8"; ctx.shadowColor = "#ffbd43"; ctx.shadowBlur = 14; ctx.lineWidth = 2.2;
      for (const trail of state.skills.coinVacuum.trails) {
        const x = trail.x + (centerX - trail.x) * ease;
        const y = trail.y + (centerY - trail.y) * ease;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(centerX, centerY); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 5 * (1 - progress) + 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1 - progress; ctx.lineWidth = 5 - progress * 3;
      ctx.beginPath(); ctx.arc(centerX, centerY, 55 + progress * 95, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }

    if (state.skills.starfall.active > 0 || state.skills.starfall.aiming) {
      ctx.save();
      const config = GAME_CONFIG.skills.starfall;
      const aiming = state.skills.starfall.aiming;
      const alpha = aiming ? 0.48 + Math.sin(this.time * 6) * 0.08 : state.skills.starfall.active / config.activeDuration;
      ctx.globalAlpha = alpha;
      ctx.translate(centerX, centerY);
      ctx.rotate(aiming ? state.skills.starfall.aimAngle : state.skills.starfall.angle);
      const radius = 670;
      const wedge = ctx.createRadialGradient(0, 0, 30, 0, 0, radius);
      wedge.addColorStop(0, aiming ? "rgba(255,231,137,.58)" : "rgba(255,244,178,.5)"); wedge.addColorStop(.42, aiming ? "rgba(255,173,80,.26)" : "rgba(188,156,255,.22)"); wedge.addColorStop(1, "rgba(188,156,255,0)");
      ctx.fillStyle = wedge;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius, -config.coneHalfAngle, config.coneHalfAngle); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = aiming ? "#ffd476" : "#fff1b0"; ctx.lineWidth = aiming ? 2.8 : 2.3; ctx.shadowColor = aiming ? "#ff9f45" : "#d7b4ff"; ctx.shadowBlur = 10;
      if (aiming) ctx.setLineDash([14, 9]);
      for (let lane = -3; lane <= 3; lane += 1) {
        const spread = lane * 26;
        const travel = 370 + (lane + 3) * 38;
        ctx.beginPath(); ctx.moveTo(95, spread * .35); ctx.lineTo(travel, spread); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
      if (aiming) {
        ctx.save(); ctx.textAlign = "center"; ctx.fillStyle = "#ffe7a0"; ctx.font = "900 13px 'Microsoft YaHei UI', sans-serif"; ctx.shadowColor = "#3b1424"; ctx.shadowBlur = 8;
        ctx.fillText("移动鼠标选择方向 · 点击释放 · Esc 取消", centerX, height - 34); ctx.restore();
      }
    }
    if (state.skills.heal.burst > 0) {
      const config = GAME_CONFIG.skills.heal;
      const progress = 1 - state.skills.heal.burst / config.burstDuration;
      ctx.save(); ctx.translate(centerX, centerY); ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = "#bafaff"; ctx.fillStyle = "#eaffff"; ctx.shadowColor = "#72eaff"; ctx.shadowBlur = 16; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 45 + progress * config.burstRadius, 0, Math.PI * 2); ctx.stroke();
      for (let shard = 0; shard < 14; shard += 1) {
        const angle = shard * Math.PI * 2 / 14 + progress * .35;
        const distance = 55 + progress * (config.burstRadius - 25);
        ctx.save(); ctx.rotate(angle); ctx.translate(distance, 0); ctx.rotate(progress * 3 + angle);
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -4); ctx.lineTo(-2, 5); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      ctx.restore();
    }
    if (state.skills.overload.pulse > 0) {
      const config = GAME_CONFIG.skills.overload;
      const progress = 1 - state.skills.overload.pulse / config.pulseDuration;
      ctx.save(); ctx.translate(centerX, centerY);
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = state.skills.overload.overheated ? "#ff7650" : "#c9a6ff";
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18; ctx.lineWidth = 7 - progress * 4;
      ctx.beginPath(); ctx.arc(0, 0, 45 + progress * config.knockbackRadius, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  drawWaveWarning(ctx, state) {
    const wave = state.wave;
    const warningTime = GAME_CONFIG.waves.warning;
    const countdown = wave.nextAt - state.time;
    const warning = wave.warningStarted && countdown > 0 && countdown <= warningTime;
    if (!warning && !wave.active) return;
    const direction = wave.direction;
    const { width, height } = GAME_CONFIG.arena;
    const pulse = 0.45 + Math.sin(this.time * 8) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse;
    const edge = ctx.createLinearGradient(direction === 1 ? width : 0, direction === 2 ? height : 0, direction === 3 ? width : 0, direction === 0 ? height : 0);
    edge.addColorStop(0, "rgba(255,48,76,.62)");
    edge.addColorStop(1, "rgba(255,48,76,0)");
    ctx.fillStyle = edge;
    if (direction === 0) ctx.fillRect(0, 0, width, 92);
    else if (direction === 1) ctx.fillRect(width - 92, 0, 92, height);
    else if (direction === 2) ctx.fillRect(0, height - 92, width, 92);
    else if (direction === 3) ctx.fillRect(0, 0, 92, height);
    ctx.restore();

    const names = ["北侧", "东侧", "南侧", "西侧"];
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(28,5,20,.88)";
    ctx.strokeStyle = "rgba(255,100,111,.72)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(width / 2 - 116, 24, 232, 54, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffb7ac";
    ctx.font = "800 14px 'Microsoft YaHei UI', sans-serif";
    ctx.fillText(warning ? `怪潮将在 ${Math.max(1, Math.ceil(countdown))} 秒后抵达` : "怪潮正在涌入", width / 2, 47);
    ctx.fillStyle = "#ff746f";
    ctx.font = "700 10px 'Microsoft YaHei UI', sans-serif";
    ctx.fillText(`${names[direction] ?? "四周"} · 准备迎击`, width / 2, 66);
    ctx.restore();
  }

  drawRange(ctx, state) {
    const stats = getTowerStats(state);
    const { centerX, centerY } = GAME_CONFIG.arena;
    ctx.save();
    ctx.strokeStyle = "rgba(124,238,255,.045)";
    ctx.fillStyle = "rgba(106,79,207,.018)";
    ctx.setLineDash([4, 14]);
    ctx.beginPath(); ctx.arc(centerX, centerY, stats.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  drawCoins(ctx, state) {
    for (const orb of state.coinOrbs) {
      const x = orb.renderX ?? orb.x;
      const y = orb.renderY ?? orb.y;
      ctx.save();
      if (!orb.collector && orb.age >= GAME_CONFIG.coins.blinkStart) {
        const remaining = Math.max(0, GAME_CONFIG.coins.lifetime - orb.age);
        const urgent = remaining <= 1;
        const pulse = urgent ? 0.5 + Math.sin(orb.age * 30) * 0.5 : 0.72 + Math.sin(orb.age * 12) * 0.28;
        const scale = urgent ? 0.62 + remaining * 0.38 : 1;
        ctx.globalAlpha = Math.max(0.12, pulse);
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.translate(-x, -y);
      }
      const pileCount = orb.pileCount ?? 1;
      const coinRadius = Math.min(9, 5 + Math.log2(pileCount) * 0.9);
      ctx.shadowColor = "#ffc96b";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ffe09a";
      ctx.beginPath(); ctx.arc(x, y, coinRadius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9e5f24";
      ctx.fillRect(x - 1, y - coinRadius * 0.62, 2, coinRadius * 1.24);
      if (pileCount > 1) {
        ctx.shadowBlur = 4;
        ctx.fillStyle = "#fff1af";
        ctx.font = "800 9px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(`×${pileCount}`, x, y - coinRadius - 6);
      }
      if (!orb.collector) {
        ctx.globalAlpha = 0.5 + Math.sin(this.time * 5 + orb.age) * 0.25;
        ctx.strokeStyle = "#ffe09a";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawPermanentResources(ctx, state) {
    for (const drop of state.resourceDrops ?? []) {
      const x = drop.renderX ?? drop.x;
      const y = drop.renderY ?? drop.y;
      const core = drop.resourceType === "core";
      const image = core ? this.assets.coreFragment : this.assets.echoShard;
      const size = core ? 52 : 43;
      ctx.save();
      ctx.translate(x, y);
      const pulse = 1 + Math.sin(this.time * (core ? 3.2 : 4.2) + drop.phase) * .06;
      ctx.scale(pulse, pulse);
      ctx.shadowColor = core ? "#ff85d8" : "#79eaff";
      ctx.shadowBlur = core ? 22 : 15;
      if (imageReady(image)) ctx.drawImage(image, -size / 2, -size / 2, size, size);
      else {
        ctx.fillStyle = core ? "#ffd3f5" : "#a8f6ff";
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-9, -9, 18, 18);
      }
      ctx.rotate(-Math.PI / 4);
      ctx.globalAlpha = .55 + Math.sin(this.time * 4 + drop.phase) * .2;
      ctx.strokeStyle = core ? "#ffc6ed" : "#9af4ff";
      ctx.lineWidth = core ? 2 : 1.25;
      ctx.beginPath(); ctx.arc(0, 0, size * .55, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      if (drop.value > 1) {
        ctx.font = "800 11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff7cf";
        ctx.fillText(`×${drop.value}`, 0, -size * .58);
      }
      ctx.restore();
    }
  }
  drawEmberZones(ctx, state) {
    for (const zone of state.emberZones ?? []) {
      const ratio = Math.max(0, zone.life / zone.maxLife);
      ctx.save();
      ctx.translate(zone.x, zone.y);
      ctx.globalAlpha = Math.min(1, ratio * 1.6);
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, zone.radius);
      glow.addColorStop(0, "rgba(255,214,111,.36)");
      glow.addColorStop(.45, "rgba(255,92,43,.2)");
      glow.addColorStop(1, "rgba(97,16,32,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, zone.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,126,61,.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 9]);
      ctx.rotate(this.time * .8 + zone.id);
      ctx.beginPath(); ctx.arc(0, 0, zone.radius * .72, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      for (let ember = 0; ember < 8; ember += 1) {
        const angle = ember * Math.PI / 4 + this.time * .5;
        const distance = zone.radius * (.22 + (ember % 3) * .18);
        const lift = Math.sin(this.time * 5 + ember) * 5;
        ctx.fillStyle = ember % 2 ? "#ff6a38" : "#ffd16e";
        ctx.beginPath(); ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance + lift, 1.5 + ember % 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawRelicDecoys(ctx, state) {
    for (const decoy of state.decoys ?? []) {
      const pulse = 1 + Math.sin(this.time * 6 + decoy.id) * .08;
      ctx.save();
      ctx.translate(decoy.x, decoy.y);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = "#d58cff";
      ctx.shadowBlur = 28;
      ctx.fillStyle = "rgba(31,13,69,.85)";
      ctx.strokeStyle = "#a9f5ff";
      ctx.lineWidth = 2;
      ctx.rotate(this.time * .45);
      ctx.beginPath();
      ctx.moveTo(0, -decoy.radius); ctx.lineTo(decoy.radius * .72, 0); ctx.lineTo(0, decoy.radius); ctx.lineTo(-decoy.radius * .72, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.rotate(-this.time * 1.4);
      ctx.strokeStyle = "rgba(221,161,255,.72)";
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.arc(0, 0, decoy.radius * 1.35, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#fff1bc";
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      const hpRatio = Math.max(0, decoy.hp / decoy.maxHp);
      ctx.fillStyle = "rgba(3,4,17,.8)"; ctx.fillRect(decoy.x - 30, decoy.y + decoy.radius + 10, 60, 5);
      ctx.fillStyle = "#b78cff"; ctx.fillRect(decoy.x - 30, decoy.y + decoy.radius + 10, 60 * hpRatio, 5);
      ctx.fillStyle = "#eefcff"; ctx.font = "800 9px Microsoft YaHei UI,sans-serif"; ctx.textAlign = "center"; ctx.fillText("诡光诱饵", decoy.x, decoy.y - decoy.radius - 10);
    }
  }
  drawProjectiles(ctx, state) {
    for (const projectile of state.projectiles) {
      if (projectile.mirrorRefraction) {
        const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
        const ux = projectile.vx / speed;
        const uy = projectile.vy / speed;
        ctx.save();
        ctx.strokeStyle = "rgba(141,255,235,.88)";
        ctx.shadowColor = "#8dffeb";
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 4]);
        ctx.beginPath();
        ctx.moveTo(projectile.x - ux * 28 - uy * 4, projectile.y - uy * 28 + ux * 4);
        ctx.lineTo(projectile.x - ux * 13 + uy * 5, projectile.y - uy * 13 - ux * 5);
        ctx.lineTo(projectile.x, projectile.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(Math.atan2(projectile.vy, projectile.vx) + Math.PI / 4);
        ctx.fillStyle = "#dffff8";
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
        continue;
      }
      if (projectile.source === "sawGun") {
        const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
        const tx = projectile.x - projectile.vx / speed * 9;
        const ty = projectile.y - projectile.vy / speed * 9;
        ctx.save();
        ctx.strokeStyle = "rgba(255,154,55,.42)";
        ctx.lineWidth = 3;
        ctx.setLineDash([2, 5]);
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(this.time * 18 + projectile.id * 0.71);
        ctx.shadowColor = "#ff9d3b";
        ctx.shadowBlur = 13;
        ctx.fillStyle = "#7b321c";
        ctx.strokeStyle = "#ffd071";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let point = 0; point < 8; point += 1) {
          const angle = point * Math.PI / 4;
          const radius = point % 2 ? 3.2 : 8.5;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff2b0";
        ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      if (projectile.element) {
        const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
        const ux = projectile.vx / speed;
        const uy = projectile.vy / speed;
        const angle = Math.atan2(projectile.vy, projectile.vx);
        ctx.save();
        const sprite = this.assets[`projectile${projectile.element[0].toUpperCase()}${projectile.element.slice(1)}`];
        const spriteSizes = { frost: [58, 29], fire: [56, 32], lightning: [52, 34] };
        if (projectile.element === "frost") {
          const gradient = ctx.createLinearGradient(projectile.x - ux * 24, projectile.y - uy * 24, projectile.x, projectile.y);
          gradient.addColorStop(0, "rgba(109,220,255,0)"); gradient.addColorStop(1, "#d9fbff");
          ctx.strokeStyle = gradient; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(projectile.x - ux * 24, projectile.y - uy * 24); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
          ctx.translate(projectile.x, projectile.y); ctx.rotate(angle);
          if (imageReady(sprite)) {
            const [width, height] = spriteSizes.frost;
            ctx.shadowColor = "#73ddff"; ctx.shadowBlur = 15;
            ctx.drawImage(sprite.cutout ?? sprite, -width * .56, -height / 2, width, height);
            ctx.restore();
            continue;
          }
          ctx.shadowColor = "#73ddff"; ctx.shadowBlur = 14; ctx.fillStyle = "#9feaff"; ctx.strokeStyle = "#efffff"; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-1, -6); ctx.lineTo(-8, 0); ctx.lineTo(-1, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (projectile.element === "fire") {
          const gradient = ctx.createLinearGradient(projectile.x - ux * 28, projectile.y - uy * 28, projectile.x, projectile.y);
          gradient.addColorStop(0, "rgba(255,93,45,0)"); gradient.addColorStop(.55, "rgba(255,104,48,.55)"); gradient.addColorStop(1, "#ffe19a");
          ctx.strokeStyle = gradient; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(projectile.x - ux * 28, projectile.y - uy * 28); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
          ctx.translate(projectile.x, projectile.y); ctx.rotate(angle); ctx.shadowColor = "#ff7038"; ctx.shadowBlur = 17;
          if (imageReady(sprite)) {
            const [width, height] = spriteSizes.fire;
            ctx.drawImage(sprite, -width * .58, -height / 2, width, height);
            ctx.restore();
            continue;
          }
          ctx.fillStyle = "#ff7b3d"; ctx.beginPath(); ctx.arc(0, 0, 6.3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff1a4"; ctx.beginPath(); ctx.arc(1.5, -1.5, 2.7, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.strokeStyle = "rgba(206,190,255,.85)"; ctx.lineWidth = 2.5; ctx.shadowColor = "#aa8cff"; ctx.shadowBlur = 14;
          ctx.beginPath();
          for (let step = 0; step <= 4; step += 1) {
            const back = 22 - step * 5.5;
            const side = step % 2 ? 4 : -3;
            const px = projectile.x - ux * back - uy * side;
            const py = projectile.y - uy * back + ux * side;
            step ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
          ctx.translate(projectile.x, projectile.y); ctx.rotate(angle);
          if (imageReady(sprite)) {
            const [width, height] = spriteSizes.lightning;
            ctx.drawImage(sprite.cutout ?? sprite, -width * .5, -height / 2, width, height);
            ctx.restore();
            continue;
          }
          ctx.fillStyle = "#f4edff"; ctx.beginPath(); ctx.arc(0, 0, 5.2, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#b89cff"; ctx.beginPath(); ctx.arc(0, 0, 8.5 + Math.sin(this.time * 20) * 1.5, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
        continue;
      }
      const tail = 14 + projectile.tier * 5;
      const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
      const tx = projectile.x - projectile.vx / speed * tail;
      const ty = projectile.y - projectile.vy / speed * tail;
      const gradient = ctx.createLinearGradient(tx, ty, projectile.x, projectile.y);
      gradient.addColorStop(0, "rgba(124,238,255,0)");
      gradient.addColorStop(1, projectile.tier >= 2 ? "#fff2af" : "#b9f8ff");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3 + projectile.tier;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.radius * 0.55, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawSummonRifts(ctx, state) {
    for (const rift of state.summonRifts ?? []) {
      const progress = 1 - Math.max(0, rift.life) / rift.maxLife;
      const pulse = 0.5 + Math.sin(this.time * 18 + rift.id) * 0.5;
      const radius = 20 + progress * 22;
      ctx.save();
      ctx.translate(rift.x, rift.y);
      ctx.globalAlpha = 0.35 + progress * 0.55;
      ctx.fillStyle = `rgba(107,24,151,${0.18 + progress * 0.18})`;
      ctx.strokeStyle = progress > 0.72 ? "#ff6bcf" : "#d99aff";
      ctx.shadowColor = "#b743ff";
      ctx.shadowBlur = 18 + pulse * 10;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.rotate(this.time * 2.8 + rift.id);
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(0, 0, radius * .72, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      for (let rune = 0; rune < 6; rune += 1) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(radius * .55, -5); ctx.lineTo(radius * .78, 0); ctx.lineTo(radius * .55, 5);
        ctx.stroke();
      }
      if (rift.attackable) {
        const target = state.enemies.find((enemy) => enemy.id === rift.targetId && enemy.hp > 0);
        const hpRatio = target ? Math.max(0, target.hp / target.maxHp) : 0;
        ctx.rotate(-this.time * 2.8 - rift.id);
        ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fillRect(-28, radius + 9, 56, 5);
        ctx.fillStyle = "#ff8fe4"; ctx.fillRect(-28, radius + 9, 56 * hpRatio, 5);
        ctx.fillStyle = "#fff1ff"; ctx.font = "800 9px Microsoft YaHei UI,sans-serif"; ctx.textAlign = "center"; ctx.fillText("可摧毁裂隙", 0, radius + 27);
        ctx.rotate(this.time * 2.8 + rift.id);
      }
      ctx.rotate(-this.time * 5.6);
      ctx.strokeStyle = "#fff0ff"; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -radius * .42); ctx.lineTo(radius * .38, radius * .28); ctx.lineTo(-radius * .38, radius * .28); ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
  }

  drawHostileProjectiles(ctx, state) {

    for (const projectile of state.hostileProjectiles ?? []) {
      const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
      const ux = projectile.vx / speed;
      if (projectile.kind === "colossusMortar" && imageReady(this.assets.bossProjectile)) {
      const uy = projectile.vy / speed;
        const angle = Math.atan2(projectile.vy, projectile.vx);
        const pulse = 0.72 + Math.sin(this.time * 24 + projectile.id) * 0.18;
        ctx.save();
        ctx.globalAlpha = .34 + pulse * .22;
        ctx.strokeStyle = "#ff5b9f"; ctx.shadowColor = "#b237ff"; ctx.shadowBlur = 12; ctx.lineWidth = 2;
        ctx.setLineDash([7, 7]);
        ctx.beginPath(); ctx.arc(projectile.targetX, projectile.targetY, 28 + pulse * 9, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
        ctx.save();
        const trail = ctx.createLinearGradient(projectile.x - ux * 70, projectile.y - uy * 70, projectile.x, projectile.y);
        trail.addColorStop(0, "rgba(92,25,171,0)"); trail.addColorStop(.55, "rgba(198,54,255,.55)"); trail.addColorStop(1, "#fff3ff");
        ctx.strokeStyle = trail; ctx.lineWidth = 11; ctx.shadowColor = "#d438ff"; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.moveTo(projectile.x - ux * 70, projectile.y - uy * 70); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
        ctx.translate(projectile.x, projectile.y); ctx.rotate(angle);
        ctx.globalAlpha = .92 + pulse * .08;
        ctx.shadowColor = "#ff42bb"; ctx.shadowBlur = 24;
        ctx.drawImage(this.assets.bossProjectile, -66, -24, 132, 48);
        ctx.restore();
        continue;
      }
      ctx.save();
      const trail = ctx.createLinearGradient(projectile.x - ux * 42, projectile.y - uy * 42, projectile.x, projectile.y);
      trail.addColorStop(0, "rgba(137,35,178,0)");
      trail.addColorStop(.55, "rgba(230,55,120,.55)");
      trail.addColorStop(1, "#ffb04d");
      ctx.strokeStyle = trail; ctx.lineWidth = 9; ctx.shadowColor = "#ff3f69"; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(projectile.x - ux * 42, projectile.y - uy * 42); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
      ctx.translate(projectile.x, projectile.y); ctx.rotate(this.time * 7 + projectile.id);
      ctx.fillStyle = "#391348"; ctx.strokeStyle = "#ff8158"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let point = 0; point < 8; point += 1) {
        const angle = point * Math.PI / 4;
        const radius = point % 2 ? projectile.radius * .62 : projectile.radius;
        point ? ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius) : ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff0a3"; ctx.beginPath(); ctx.arc(0, 0, projectile.radius * .3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  drawElementFx(ctx, state) {
    for (const effect of state.elementFx) {
      if (effect.element !== "lightning") continue;
      const alpha = Math.max(0, effect.life / effect.maxLife);
      const dx = effect.x2 - effect.x1;
      const dy = effect.y2 - effect.y1;
      const length = Math.hypot(dx, dy) || 1;
      const sprite = this.assets.effectLightning;
      if (imageReady(sprite)) {
        const height = Math.max(22, Math.min(38, length * .22)) * (1 + Math.sin(this.time * 28 + effect.x1) * .08);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(effect.x1, effect.y1);
        ctx.rotate(Math.atan2(dy, dx));
        ctx.shadowColor = "#9878ff";
        ctx.shadowBlur = 13;
        ctx.drawImage(sprite.cutout ?? sprite, 0, -height / 2, length, height);
        ctx.restore();
        continue;
      }
      const nx = -dy / length;
      const ny = dx / length;
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = "#d8c7ff"; ctx.lineWidth = 2.4; ctx.shadowColor = "#9878ff"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(effect.x1, effect.y1);
      for (let step = 1; step < 5; step += 1) {
        const t = step / 5;
        const jitter = (step % 2 ? 1 : -1) * (5 + step % 3);
        ctx.lineTo(effect.x1 + dx * t + nx * jitter, effect.y1 + dy * t + ny * jitter);
      }
      ctx.lineTo(effect.x2, effect.y2); ctx.stroke(); ctx.restore();
    }
  }

  drawEnemies(ctx, state) {
    for (const anchor of state.enemies.filter((enemy) => enemy.type === "anchor" && enemy.hp > 0 && !enemy.riftAnchor)) {
      const boss = state.enemies.find((enemy) => enemy.id === anchor.anchorBossId && enemy.hp > 0);
      if (!boss) continue;
      const visual = ANCHOR_VISUALS[anchor.anchorRole] ?? ANCHOR_VISUALS.shield;
      ctx.save(); ctx.strokeStyle = visual.color; ctx.globalAlpha = .48; ctx.shadowColor = visual.color; ctx.shadowBlur = 9; ctx.lineWidth = anchor.anchorRole === "overload" ? 2.5 : 1.6; ctx.setLineDash(anchor.anchorRole === "repair" ? [2, 5] : anchor.anchorRole === "summon" ? [9, 6] : [5, 7]);
      ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(boss.x, boss.y); ctx.stroke(); ctx.restore();
    }
    for (const enemy of state.enemies) {
      if (enemy.riftAnchor) continue;
      const [bright, dark] = ENEMY_COLORS[enemy.type];
      if (enemy.rangedFlash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, enemy.rangedFlash * 6.25);
        ctx.strokeStyle = "#c795ff";
        ctx.shadowColor = "#8d4dff";
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(GAME_CONFIG.arena.centerX, GAME_CONFIG.arena.centerY); ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      const angle = enemy.type === "colossus" ? (enemy.orbitAngle ?? 0) + Math.PI / 2 : Math.atan2(GAME_CONFIG.arena.centerY - enemy.y, GAME_CONFIG.arena.centerX - enemy.x);
      ctx.rotate(angle);
      const resistanceColor = { frost: "#7de8ff", fire: "#ff754d", lightning: "#c6a2ff" }[enemy.resistance];
      ctx.shadowColor = enemy.type === "boss" ? resistanceColor ?? bright : bright;
      ctx.shadowBlur = enemy.type === "colossus" ? 24 : enemy.type === "boss" ? 18 : 7;
      const isBoss = enemy.type === "boss";
      const isColossus = enemy.type === "colossus";
      const isAnchor = enemy.type === "anchor";
      const isWaveType = enemy.type === "crawler" || enemy.type === "sentinel";
      const atlas = isWaveType ? this.assets.waveEnemies : this.assets.enemies;
      if (isAnchor) {
        const visual = ANCHOR_VISUALS[enemy.anchorRole] ?? ANCHOR_VISUALS.shield;
        ctx.rotate(-angle + this.time * 1.7);
        ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : visual.dark; ctx.strokeStyle = visual.color; ctx.lineWidth = 2; ctx.shadowColor = visual.color; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(0, -enemy.radius); ctx.lineTo(enemy.radius * .72, 0); ctx.lineTo(0, enemy.radius); ctx.lineTo(-enemy.radius * .72, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.rotate(-this.time * 1.7); ctx.fillStyle = "#fff"; ctx.font = "900 14px 'Microsoft YaHei UI',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(visual.symbol, 0, 0);
      } else if (isColossus && imageReady(this.assets.colossus)) {
        const width = enemy.radius * 3.5;
        const height = width * .572;
        ctx.globalAlpha = enemy.hitFlash > 0 ? 0.72 : 1;
        ctx.drawImage(this.assets.colossus, -width / 2, -height / 2, width, height);
        if (enemy.hitFlash > 0) {
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = Math.min(0.72, enemy.hitFlash * 7);
          ctx.drawImage(this.assets.colossus, -width / 2, -height / 2, width, height);
        }
      } else if (isBoss && imageReady(this.assets.boss)) {
        const size = enemy.radius * 4.45;
        ctx.globalAlpha = enemy.hitFlash > 0 ? 0.72 : 1;
        ctx.drawImage(this.assets.boss, -size / 2, -size / 2, size, size);
        if (enemy.hitFlash > 0) {
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = Math.min(0.72, enemy.hitFlash * 7);
          ctx.drawImage(this.assets.boss, -size / 2, -size / 2, size, size);
        }
      } else if (imageReady(atlas)) {
        const cell = isWaveType ? atlas.naturalWidth / 2 : atlas.naturalWidth / 2;
        const positions = { wisp: [0, 0], runner: [1, 0], brute: [0, 1], boss: [1, 1], crawler: [0, 0], sentinel: [1, 0], hexer: [0, 0], rammer: [0, 1] };
        const [column, row] = positions[enemy.type];
        const size = enemy.radius * (isBoss ? 3.15 : 3.05);
        ctx.globalAlpha = enemy.hitFlash > 0 ? 0.68 : 1;
        ctx.drawImage(atlas, column * cell, row * cell, cell, cell, -size / 2, -size / 2, size, size);
        if (enemy.hitFlash > 0) {
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = Math.min(0.75, enemy.hitFlash * 7);
          ctx.drawImage(atlas, column * cell, row * cell, cell, cell, -size / 2, -size / 2, size, size);
        }
        if (enemy.type === "hexer" || enemy.type === "rammer" || enemy.elite) {
          ctx.save();
          ctx.globalCompositeOperation = enemy.elite ? "screen" : "source-over";
          ctx.globalAlpha = enemy.elite ? .58 : .82;
          ctx.filter = enemy.elite
            ? "sepia(1) saturate(4.2) hue-rotate(345deg) brightness(1.35)"
            : enemy.type === "hexer"
              ? "hue-rotate(65deg) saturate(1.7) brightness(1.12)"
              : "sepia(.5) saturate(2.2) hue-rotate(335deg) brightness(1.12)";
          ctx.drawImage(atlas, column * cell, row * cell, cell, cell, -size / 2, -size / 2, size, size);
          ctx.restore();
        }
      } else {
        ctx.fillStyle = enemy.hitFlash > 0 ? "#fff7ef" : dark;
        ctx.strokeStyle = bright;
        ctx.lineWidth = isBoss || isColossus ? 3 : 1.5;
        ctx.beginPath();
        if (enemy.type === "runner") {
          ctx.moveTo(enemy.radius, 0); ctx.lineTo(-enemy.radius, -enemy.radius * .72); ctx.lineTo(-enemy.radius * .55, 0); ctx.lineTo(-enemy.radius, enemy.radius * .72);
        } else {
          const points = isBoss || isColossus ? 12 : enemy.type === "brute" ? 8 : 0;
          if (points) for (let i = 0; i < points; i += 1) { const a = i * Math.PI * 2 / points; const r = i % 2 ? enemy.radius * .75 : enemy.radius; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
          else { ctx.moveTo(enemy.radius, 0); ctx.quadraticCurveTo(0, -enemy.radius * 1.1, -enemy.radius, 0); ctx.quadraticCurveTo(0, enemy.radius * 1.1, enemy.radius, 0); }
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = bright;
        ctx.beginPath(); ctx.arc(enemy.radius * .18, 0, Math.max(2.5, enemy.radius * .18), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      if (isAnchor) {
        const visual = ANCHOR_VISUALS[enemy.anchorRole] ?? ANCHOR_VISUALS.shield;
        ctx.save(); ctx.textAlign = "center"; ctx.font = "800 11px 'Microsoft YaHei UI',sans-serif"; ctx.fillStyle = visual.color; ctx.shadowColor = "#120a2d"; ctx.shadowBlur = 6;
        ctx.fillText(enemy.counterSkill === "artillery" ? "炮击锚点" : `${visual.name}锚点`, enemy.x, enemy.y + enemy.radius + 22); ctx.restore();
      }

      if (enemy.type === "boss") {
        const phaseColor = { frost: "#7de8ff", fire: "#ff754d", lightning: "#c6a2ff" }[enemy.resistance] ?? "#ffd078";
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(this.time * .45); ctx.strokeStyle = phaseColor; ctx.shadowColor = phaseColor; ctx.shadowBlur = 14; ctx.lineWidth = 2.4; ctx.setLineDash([12, 8]);
        ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 22, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        for (let index = 0; index < 3; index += 1) { const a = index * Math.PI * 2 / 3; ctx.fillStyle = phaseColor; ctx.beginPath(); ctx.arc(Math.cos(a) * (enemy.radius + 22), Math.sin(a) * (enemy.radius + 22), 3.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      if (enemy.type === "colossus") {
        if ((enemy.spawnShield ?? 0) > 0) {
          const shieldRatio = enemy.spawnShield / enemy.spawnShieldMax;
          const pulse = 0.5 + Math.sin(this.time * 5.5) * 0.5;
          ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(this.time * .55);
          ctx.globalAlpha = .48 + shieldRatio * .34;
          ctx.fillStyle = "rgba(91,170,255,.08)"; ctx.strokeStyle = "#89e8ff";
          ctx.shadowColor = "#54a9ff"; ctx.shadowBlur = 22 + pulse * 12; ctx.lineWidth = 3.5;
          ctx.setLineDash([18, 7]); ctx.beginPath(); ctx.ellipse(0, 0, enemy.radius + 78, enemy.radius + 44, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.rotate(-this.time * 1.1); ctx.strokeStyle = "#c6f8ff"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 11]);
          ctx.beginPath(); ctx.ellipse(0, 0, enemy.radius + 66, enemy.radius + 34, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        if ((enemy.exposedTimer ?? 0) > 0) {
          ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(-this.time * 1.2); ctx.strokeStyle = "#fff1a8"; ctx.shadowColor = "#ffcf5b"; ctx.shadowBlur = 24; ctx.lineWidth = 4; ctx.setLineDash([16, 7]); ctx.beginPath(); ctx.ellipse(0, 0, enemy.radius + 92, enemy.radius + 54, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#fff4ba"; ctx.font = "900 11px Microsoft YaHei UI,sans-serif"; ctx.textAlign = "center"; ctx.fillText(`弱点暴露 ${enemy.exposedTimer.toFixed(1)}s`, 0, -enemy.radius - 69); ctx.restore();
        }
        if ((enemy.phaseBreakInvulnerability ?? 0) > 0) {
          const ratio = enemy.phaseBreakInvulnerability / GAME_CONFIG.colossus.phaseBreakInvulnerability;
          ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.globalAlpha = ratio;
          ctx.strokeStyle = "#fff3ff"; ctx.shadowColor = "#ff47bb"; ctx.shadowBlur = 28; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 45 + (1 - ratio) * 80, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        const announcedSkill = enemy.intentSkill ?? enemy.activeSkill;
        const skillVisual = COLOSSUS_SKILLS[announcedSkill];
        const affixVisual = COLOSSUS_AFFIXES[enemy.colossusAffix] ?? { name: "未知异变", color: "#b865ff" };
        const color = skillVisual?.color ?? affixVisual.color;
        if (enemy.intentSkill) {
          const pulse = 0.5 + Math.sin(this.time * 9) * 0.5;
          ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = `${color}22`; ctx.shadowColor = color; ctx.shadowBlur = 20; ctx.lineWidth = 3 + pulse * 3; ctx.setLineDash([11, 8]);
          if (enemy.intentSkill === "beam" || enemy.intentSkill === "artillery") {
            ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(GAME_CONFIG.arena.centerX, GAME_CONFIG.arena.centerY); ctx.stroke();
            ctx.beginPath(); ctx.arc(GAME_CONFIG.arena.centerX, GAME_CONFIG.arena.centerY, 42 + pulse * 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          } else {
            ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius + 35 + pulse * 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }
          ctx.setLineDash([]); ctx.restore();
        }
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(-this.time * (enemy.enraged ? .7 : .32)); ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = enemy.enraged ? 26 : 18; ctx.lineWidth = enemy.activeSkill === "bulwark" ? 5 : enemy.enraged ? 4 : 2.5;
        ctx.setLineDash(announcedSkill ? [16, 8] : [5, 12]); ctx.beginPath(); ctx.ellipse(0, 0, enemy.radius + 58, enemy.radius + 27, 0, 0, Math.PI * 2); ctx.stroke();
        if (enemy.enraged) { ctx.strokeStyle = "#ff5a36"; ctx.beginPath(); ctx.ellipse(0, 0, enemy.radius + 68, enemy.radius + 37, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.setLineDash([]); ctx.restore();
        if (announcedSkill) {
          ctx.save(); ctx.textAlign = "center"; ctx.font = "900 12px 'Microsoft YaHei UI',sans-serif"; ctx.fillStyle = color; ctx.shadowColor = "#16051f"; ctx.shadowBlur = 8;
          const label = enemy.intentSkill ? `蓄势 · ${skillVisual.name} ${Math.max(0, enemy.intentTimer).toFixed(1)}s` : skillVisual.name;
          ctx.fillText(label, enemy.x, enemy.y + enemy.radius + 38);
          ctx.fillStyle = enemy.enraged ? "#ff9a68" : affixVisual.color;
          ctx.fillText(`${affixVisual.name}${enemy.enraged ? " · 狂化 / 冰冻免疫" : ""}`, enemy.x, enemy.y + enemy.radius + 54); ctx.restore();
        }
      }

      if (enemy.type === "hexer") {
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(-this.time * 1.8);
        ctx.fillStyle = "#e4c4ff"; ctx.shadowColor = "#9c62ff"; ctx.shadowBlur = 8;
        for (let mote = 0; mote < 3; mote += 1) { const a = mote * Math.PI * 2 / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * (enemy.radius + 5), Math.sin(a) * (enemy.radius + 5), 2.2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      } else if (enemy.type === "rammer") {
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(Math.atan2(GAME_CONFIG.arena.centerY - enemy.y, GAME_CONFIG.arena.centerX - enemy.x));
        ctx.fillStyle = "#ffd66d"; ctx.shadowColor = "#ff8b3d"; ctx.shadowBlur = 7;
        ctx.beginPath(); ctx.moveTo(enemy.radius + 9, 0); ctx.lineTo(enemy.radius - 2, -6); ctx.lineTo(enemy.radius - 2, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      if ((enemy.unitCount ?? 1) > 1) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.font = "900 10px ui-monospace, monospace";
        ctx.fillStyle = "#ffe49a";
        ctx.shadowColor = "#8c3d18";
        ctx.shadowBlur = 7;
        ctx.fillText(`怪群 ×${enemy.unitCount}`, enemy.x, enemy.y - enemy.radius - 17);
        ctx.restore();
      }
      if (enemy.elite) {
        const pulse = Math.sin(this.time * 5 + enemy.id) * 2;
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(this.time * .7);
        ctx.strokeStyle = "#ffd35f"; ctx.shadowColor = "#ff57c8"; ctx.shadowBlur = 15; ctx.lineWidth = 2.2;
        ctx.setLineDash([8, 5]); ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 10 + pulse, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.rotate(-this.time * 1.4); ctx.strokeStyle = "#ff7bd4"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 15 - pulse * .4, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.save(); ctx.translate(enemy.x, enemy.y - enemy.radius - 19);
        ctx.rotate(Math.PI / 4); ctx.fillStyle = "#ffd35f"; ctx.strokeStyle = "#fff1ad"; ctx.lineWidth = 1;
        ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8); ctx.restore();
        const affixLabel = { shield: "护盾", sprint: "狂奔", devour: "吞金", split: "分裂" }[enemy.affix] ?? "异变";
        ctx.save(); ctx.textAlign = "center"; ctx.font = "800 11px 'Microsoft YaHei UI', sans-serif"; ctx.fillStyle = "#fff0a0"; ctx.shadowColor = "#6b164f"; ctx.shadowBlur = 6;
        ctx.fillText(affixLabel, enemy.x, enemy.y + enemy.radius + 20); ctx.restore();
        if (enemy.affix === "shield" && enemy.affixShield > 0) {
          const ratio = enemy.affixShield / enemy.affixShieldMax;
          ctx.save(); ctx.strokeStyle = "rgba(125,231,255,.9)"; ctx.lineWidth = 3; ctx.shadowColor = "#50d9ff"; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius + 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio); ctx.stroke(); ctx.restore();
        } else if (enemy.affix === "sprint") {
          const a = Math.atan2(GAME_CONFIG.arena.centerY - enemy.y, GAME_CONFIG.arena.centerX - enemy.x);
          ctx.save(); ctx.strokeStyle = "rgba(255,149,88,.75)"; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
          ctx.beginPath(); ctx.moveTo(enemy.x - Math.cos(a) * (enemy.radius + 6), enemy.y - Math.sin(a) * (enemy.radius + 6)); ctx.lineTo(enemy.x - Math.cos(a) * 52, enemy.y - Math.sin(a) * 52); ctx.stroke(); ctx.restore();
        } else if (enemy.affix === "devour") {
          ctx.save(); ctx.fillStyle = "#ffd45d"; ctx.shadowColor = "#ff9e38"; ctx.shadowBlur = 8;
          for (let i = 0; i < 3; i += 1) { const a = this.time * 2 + i * Math.PI * 2 / 3; ctx.beginPath(); ctx.arc(enemy.x + Math.cos(a) * (enemy.radius + 17), enemy.y + Math.sin(a) * (enemy.radius + 17), 3, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
        } else if (enemy.affix === "split") {
          ctx.save(); ctx.strokeStyle = "#ff9ee7"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(enemy.x - 7, enemy.y, 6, 0, Math.PI * 2); ctx.arc(enemy.x + 7, enemy.y, 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      }

      if (state.tower.priorityTargetIds?.[0] === enemy.id) {
        const protocolColor = { guard: "#7ceeff", hunter: "#ffd066", breach: "#ff716f", radar: "#b99aff" }[state.tower.targetProtocol] ?? "#7ceeff";
        const radius = enemy.radius + 27 + Math.sin(this.time * 5) * 2;
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(-this.time * .8); ctx.strokeStyle = protocolColor; ctx.shadowColor = protocolColor; ctx.shadowBlur = 10; ctx.lineWidth = 2.2;
        for (let index = 0; index < 4; index += 1) {
          const angle = index * Math.PI / 2;
          ctx.save(); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(radius - 9, -8); ctx.lineTo(radius, -8); ctx.lineTo(radius, 8); ctx.lineTo(radius - 9, 8); ctx.stroke(); ctx.restore();
        }
        ctx.restore();
      }
      if (state.tower.anchorLockTimer > 0 && state.tower.anchorLockId === enemy.id) {
        const visual = ANCHOR_VISUALS[enemy.anchorRole] ?? ANCHOR_VISUALS.shield;
        const radius = enemy.radius + 34 + Math.sin(this.time * 8) * 2;
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(this.time * 1.4); ctx.strokeStyle = visual.color; ctx.shadowColor = visual.color; ctx.shadowBlur = 16; ctx.lineWidth = 3.2;
        ctx.setLineDash([12, 6]); ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.rotate(-this.time * 1.4);
        ctx.fillStyle = "#fff7c8"; ctx.font = "900 11px 'Microsoft YaHei UI',sans-serif"; ctx.textAlign = "center"; ctx.fillText(`锁定 ${state.tower.anchorLockTimer.toFixed(1)}s`, 0, -radius - 8); ctx.restore();
      }
      if (enemy.markTimer > 0) {
        const pulse = 1 + Math.sin(this.time * 7 + enemy.id) * .08;
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.scale(pulse, pulse); ctx.strokeStyle = "#ff71d0"; ctx.shadowColor = "#ff3aae"; ctx.shadowBlur = 13; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let point = 0; point < 6; point += 1) { const a = point * Math.PI / 3; const r = enemy.radius + 24; point ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = "#ffd1ef"; ctx.font = "800 9px 'Microsoft YaHei UI',sans-serif"; ctx.textAlign = "center"; ctx.fillText("猎杀标记", 0, -enemy.radius - 30); ctx.restore();
      }

      if (enemy.freezeTimer > 0) {
        const sprite = this.assets.effectFrost;
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.globalAlpha = Math.min(1, .55 + enemy.freezeTimer * .28);
        if (imageReady(sprite)) {
          const size = enemy.radius * 2.7 + 27 + Math.sin(this.time * 6 + enemy.id) * 2;
          ctx.shadowColor = "#67dfff"; ctx.shadowBlur = 11;
          ctx.drawImage(sprite.cutout ?? sprite, -size / 2, -size / 2, size, size);
        } else {
          ctx.strokeStyle = "#a9efff"; ctx.lineWidth = 2; ctx.shadowColor = "#67dfff"; ctx.shadowBlur = 11;
          ctx.beginPath();
          for (let point = 0; point < 6; point += 1) { const a = point * Math.PI / 3; const r = enemy.radius + 6; point ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
          ctx.closePath(); ctx.stroke();
        }
        ctx.restore();
      }
      if (enemy.burnTimer > 0) {
        const sprite = this.assets.effectFire;
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(this.time * 2.4 + enemy.id); ctx.globalAlpha = .82;
        if (imageReady(sprite)) {
          const size = enemy.radius * 2.65 + 29 + Math.sin(this.time * 8 + enemy.id) * 2;
          ctx.shadowColor = "#ff6238"; ctx.shadowBlur = 10;
          ctx.drawImage(sprite.cutout ?? sprite, -size / 2, -size / 2, size, size);
        } else {
          ctx.strokeStyle = "#ff9a50"; ctx.lineWidth = 2.3; ctx.shadowColor = "#ff6238"; ctx.shadowBlur = 10;
          ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.restore();
      }

      const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
      if (hpRatio < 0.999 || isBoss || isColossus || enemy.elite) {
        const width = isColossus ? 150 : isBoss ? 92 : enemy.elite ? Math.max(48, enemy.radius * 2.5) : enemy.radius * 2;
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width, 4);
        ctx.fillStyle = isColossus ? "#ff5477" : isBoss ? "#ffc66d" : enemy.elite ? "#ffd35f" : "#ff7076"; ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width * hpRatio, 4);
      }
    }
  }

  drawSaws(ctx, state) {
    const count = state.tower.upgrades.saw;
    if (!count) return;
    const { centerX, centerY } = GAME_CONFIG.arena;
    const radius = GAME_CONFIG.upgrades.saw.radius;
    const launchedIndexes = new Set(state.launchedSaws.map((saw) => saw.bladeIndex));
    const overdrive = state.tower.upgrades.sawOverdrive;
    const drawSaw = (x, y, rotation, scale = 1) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale, scale);
      ctx.shadowColor = "#ffd47c"; ctx.shadowBlur = 11;
      if (imageReady(this.assets.saw)) {
        ctx.drawImage(this.assets.saw, -23, -23, 46, 46);
      } else {
        ctx.fillStyle = "#d7dcf1"; ctx.strokeStyle = "#ffc96b"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let tooth = 0; tooth < 16; tooth += 1) {
          const a = tooth * Math.PI / 8;
          const r = tooth % 2 ? 12 : 18;
          const px = Math.cos(a) * r; const py = Math.sin(a) * r;
          tooth ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#313653"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };
    for (let index = 0; index < count; index += 1) {
      if (launchedIndexes.has(index) || (state.tower.sawRecoveries[index] ?? 0) > 0) continue;
      const angle = state.tower.sawAngle + index * Math.PI * 2 / count;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      drawSaw(x, y, -this.time * (8 + overdrive * 2));
    }
    for (const saw of state.launchedSaws) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,211,108,.38)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(saw.x - saw.vx * .045, saw.y - saw.vy * .045); ctx.lineTo(saw.x, saw.y); ctx.stroke();
      ctx.restore();
      drawSaw(saw.x, saw.y, this.time * 18, 1.08);
    }
  }

  drawDrones(ctx, state) {
    const count = state.tower.upgrades.drone;
    if (!count) return;
    const detonate = state.tower.droneDetonateActive;
    const attacking = (state.tower.droneMode === "attack" && state.tower.upgrades.autoCollect > 0) || detonate;
    const defending = state.tower.upgrades.droneGuard > 0 && state.tower.droneMode === "collect" && state.tower.droneGuardCooldown <= 0;
    for (let index = 0; index < count; index += 1) {
      const drone = state.drones[index];
      const { x, y } = getDronePosition(state, index);
      const angle = drone?.angle ?? state.time * (1.25 + count * 0.08) + index * Math.PI * 2 / count;
      const recovering = (drone?.recoveryTimer ?? 0) > 0;
      const target = state.coinOrbs.find((orb) => orb.collector === "drone" && orb.droneIndex === index);
      const enemyTarget = attacking && drone?.targetId ? state.enemies.find((enemy) => enemy.id === drone.targetId) : null;
      ctx.save();
      if (target) {
        ctx.strokeStyle = "rgba(255,214,119,.35)";
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(target.renderX, target.renderY); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (enemyTarget) {
        ctx.strokeStyle = detonate ? "rgba(255,111,117,.36)" : "rgba(255,177,78,.18)";
        ctx.setLineDash([2, 8]);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(enemyTarget.x, enemyTarget.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2);
      const primaryColor = recovering ? "#6c718c" : detonate ? "#ff715f" : defending ? "#a88cff" : attacking ? "#ffad4d" : "#7ceeff";
      ctx.shadowColor = primaryColor; ctx.shadowBlur = recovering ? 5 : attacking || defending ? 15 : 10;
      ctx.fillStyle = recovering ? "#20253d" : detonate ? "#4a2630" : defending ? "#302653" : attacking ? "#4a2630" : "#202949";
      ctx.strokeStyle = recovering ? "#747995" : detonate ? "#ffd171" : defending ? "#d2c4ff" : attacking ? "#ffd171" : "#b9f7ff"; ctx.lineWidth = attacking || defending ? 1.7 : 1.2;
      ctx.beginPath();
      if (recovering) {
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
      } else if (attacking || defending) {
        ctx.moveTo(0, -15); ctx.lineTo(8, 2); ctx.lineTo(3, 0); ctx.lineTo(0, 8); ctx.lineTo(-3, 0); ctx.lineTo(-8, 2);
      } else {
        ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 7); ctx.lineTo(-8, 0);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = recovering ? "#8e94b7" : detonate ? "#fff0a7" : defending ? "#d9ccff" : attacking ? "#fff0a7" : "#ffc96b"; ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      const energyRatio = Math.max(0, Math.min(1, state.tower.droneEnergy / getDroneEnergyMax(state)));
      ctx.save(); ctx.fillStyle = "rgba(4,7,20,.72)"; ctx.fillRect(x - 12, y + 13, 24, 3); ctx.fillStyle = energyRatio < .2 ? "#ff705d" : detonate ? "#ffbd61" : defending ? "#c4a7ff" : attacking ? "#ffbd61" : "#74e7ff"; ctx.fillRect(x - 12, y + 13, 24 * energyRatio, 3); ctx.restore();
      if (recovering) {
        const recoveryRatio = Math.max(0, Math.min(1, drone.recoveryTimer / getDroneDetonateRecovery(state)));
        ctx.save(); ctx.strokeStyle = "rgba(255,210,143,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - recoveryRatio)); ctx.stroke(); ctx.restore();
      }
    }
  }

  drawTower(ctx, state) {
    const { centerX: x, centerY: y } = GAME_CONFIG.arena;
    const tier = state.tower.upgrades.ascend;
    const stats = getTowerStats(state);
    const hpRatio = Math.max(0, state.tower.hp / stats.maxHp);
    const overload = state.skills.overload.active > 0;
    const heatRatio = state.skills.overload.heat / GAME_CONFIG.skills.overload.overheatThreshold;

    ctx.save(); ctx.translate(x, y);
    ctx.globalAlpha = 0.18 + hpRatio * 0.12;
    ctx.fillStyle = overload ? (heatRatio >= 1 ? "#ff704d" : "#c99cff") : state.skills.overload.slow > 0 ? "#b9474f" : "#7ceeff";
    ctx.beginPath(); ctx.arc(0, 0, 55 + tier * 13 + Math.sin(this.time * 2.5) * 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    if (state.tower.droneGuardShield > 0) {
      const guardRatio = Math.min(1, state.tower.droneGuardShield / getDroneGuardShieldMax(state));
      ctx.save(); ctx.rotate(this.time * .55); ctx.globalAlpha = .24 + guardRatio * .42; ctx.strokeStyle = "#bfadff"; ctx.shadowColor = "#a789ff"; ctx.shadowBlur = 18; ctx.lineWidth = 3;
      ctx.setLineDash([5, 8]); ctx.beginPath(); ctx.arc(0, 0, 72 + tier * 10, .2, .2 + Math.PI * 2 * guardRatio); ctx.stroke(); ctx.restore();
    }
    if (state.tower.shield > 0) {
      const shieldRatio = Math.min(1, state.tower.shield / (stats.maxHp * GAME_CONFIG.skills.heal.shieldCapFraction));
      ctx.save(); ctx.rotate(-this.time * .45);
      ctx.globalAlpha = .28 + shieldRatio * .38;
      ctx.strokeStyle = "#bff9ff"; ctx.shadowColor = "#79eaff"; ctx.shadowBlur = 16; ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]); ctx.beginPath(); ctx.arc(0, 0, 66 + tier * 10, -.4, -.4 + Math.PI * 2 * shieldRatio); ctx.stroke();
      ctx.restore();
    }
    if (state.tower.upgrades.droneIntercept > 0 && state.tower.interceptCharge > 0 && state.tower.droneMode === "collect") {
      ctx.save(); ctx.rotate(this.time * .35); ctx.strokeStyle = "rgba(168,248,255,.78)"; ctx.shadowColor = "#69e4ff"; ctx.shadowBlur = 13; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let point = 0; point < 6; point += 1) { const a = point * Math.PI / 3; const r = 75 + tier * 10; point ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.stroke(); ctx.restore();
    }

    for (let ring = 0; ring <= tier; ring += 1) {
      ctx.save(); ctx.rotate(this.time * (ring % 2 ? -0.45 : 0.35) + ring);
      ctx.strokeStyle = ring === 2 ? "rgba(255,207,114,.68)" : "rgba(124,238,255,.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 10 + ring * 3]);
      ctx.beginPath(); ctx.arc(0, 0, 49 + ring * 13, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (tier === 3 && imageReady(this.assets.towerUltimate)) {
      const width = 188;
      const height = 250;
      ctx.shadowColor = overload ? "#f0b0ff" : "#b8edff";
      ctx.shadowBlur = 38 + Math.sin(this.time * 3) * 4;
      ctx.drawImage(this.assets.towerUltimate.cutout ?? this.assets.towerUltimate, -width / 2, -height * .52, width, height);
    } else if (tier < 3 && imageReady(this.assets.tower)) {
      const atlas = this.assets.tower;
      const cell = atlas.naturalWidth / 3;
      const size = [112, 142, 174][tier];
      ctx.shadowColor = overload ? "#d996ff" : "#71e8ff";
      ctx.shadowBlur = 18 + tier * 7;
      ctx.drawImage(atlas, tier * cell, 0, cell, atlas.naturalHeight, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = "#1e224a"; ctx.strokeStyle = "#6771b8"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 24, 40 + tier * 8, 18 + tier * 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const gradient = ctx.createLinearGradient(-30, -65, 25, 48);
      gradient.addColorStop(0, "#e4fdff"); gradient.addColorStop(.35, overload ? "#d8a8ff" : tier === 3 ? "#fff3c1" : "#7ceeff"); gradient.addColorStop(1, tier >= 2 ? "#9a63ff" : "#654bc2");
      ctx.fillStyle = gradient; ctx.strokeStyle = tier >= 2 ? "#ffe6a0" : "#b9f9ff"; ctx.lineWidth = 2;
      ctx.shadowColor = overload ? "#d996ff" : "#71e8ff"; ctx.shadowBlur = 22 + tier * 8;
      ctx.beginPath();
      if (tier === 0) ctx.moveTo(0, -49), ctx.lineTo(27, -5), ctx.lineTo(14, 39), ctx.lineTo(-14, 39), ctx.lineTo(-27, -5);
      else if (tier === 1) ctx.moveTo(0, -68), ctx.lineTo(23, -30), ctx.lineTo(29, 35), ctx.lineTo(0, 51), ctx.lineTo(-29, 35), ctx.lineTo(-23, -30);
      else ctx.moveTo(0, -79), ctx.lineTo(18, -47), ctx.lineTo(43, -58), ctx.lineTo(31, -19), ctx.lineTo(38, 38), ctx.lineTo(0, 58), ctx.lineTo(-38, 38), ctx.lineTo(-31, -19), ctx.lineTo(-43, -58), ctx.lineTo(-18, -47);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = .34; ctx.strokeStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(-6, -45 - tier * 10); ctx.lineTo(-12, 18); ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;
    if (tier < 3) this.drawElementModules(ctx, state, tier);

    if (hpRatio < 0.45) {
      ctx.strokeStyle = "rgba(255,100,120,.9)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(8, -7); ctx.lineTo(-1, 10); ctx.lineTo(10, 24); ctx.stroke();
    }
    ctx.restore();
  }

  drawElementModules(ctx, state, tier) {
    const upgrades = state.tower.upgrades;
    if (upgrades.frost > 0) {
      const sprite = this.assets.moduleFrost;
      ctx.save(); ctx.translate(-38 - tier * 4, -25 - tier * 5); ctx.rotate(-0.22);
      ctx.shadowColor = "#79e6ff"; ctx.shadowBlur = 13;
      if (imageReady(sprite)) {
        const width = 68 + tier * 5; const height = width;
        ctx.drawImage(sprite.cutout ?? sprite, -width * .43, -height * .52, width, height);
      } else {
        ctx.fillStyle = "#3e6fa5"; ctx.strokeStyle = "#c8f8ff"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(22, -5); ctx.lineTo(31, 0); ctx.lineTo(22, 5); ctx.lineTo(-4, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    if (upgrades.fire > 0) {
      const sprite = this.assets.moduleFire;
      ctx.save(); ctx.translate(39 + tier * 4, -3 - tier * 3 + Math.sin(this.time * 3.2) * 1.2);
      ctx.shadowColor = "#ff713d"; ctx.shadowBlur = 14;
      if (imageReady(sprite)) {
        const width = 66 + tier * 5; const height = width * 1.07;
        ctx.drawImage(sprite, -width * .48, -height * .5, width, height);
      } else {
        ctx.fillStyle = "#5b2940"; ctx.strokeStyle = "#ffbd68"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    if (upgrades.lightning > 0) {
      const orbY = -73 - tier * 8;
      const sprite = this.assets.moduleLightning;
      ctx.save(); ctx.translate(0, orbY); ctx.rotate(Math.sin(this.time * 1.7) * .035);
      ctx.shadowColor = "#9b7dff"; ctx.shadowBlur = 21;
      if (imageReady(sprite)) {
        const pulse = 1 + Math.sin(this.time * 4) * .035;
        const width = (62 + tier * 5) * pulse; const height = width * .94;
        ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
      } else {
        ctx.fillStyle = "rgba(129,102,255,.28)"; ctx.strokeStyle = "#d9cfff"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 13 + Math.sin(this.time * 4) * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawParticles(ctx, state) {
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }

  drawFloaters(ctx, state) {
    ctx.textAlign = "center"; ctx.font = "700 11px ui-monospace, monospace";
    for (const floater of state.floaters) {
      ctx.globalAlpha = Math.min(1, floater.life * 3);
      ctx.fillStyle = floater.color; ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.globalAlpha = 1;
  }

  drawBossBar(ctx, state) {
    const boss = state.enemies.find((enemy) => enemy.type === "colossus" && enemy.hp > 0)
      ?? state.enemies.find((enemy) => enemy.type === "boss" && enemy.hp > 0);
    if (!boss) return;
    const { width } = GAME_CONFIG.arena;
    const isColossus = boss.type === "colossus";
    const shifted = !isColossus && (state.wave.warningStarted || state.wave.active);
    const y = shifted ? 92 : 20;
    const barWidth = 390;
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(18,4,20,.9)";
    ctx.strokeStyle = isColossus ? "rgba(255,74,132,.68)" : "rgba(255,180,95,.55)";
    const panelHeight = isColossus ? 76 : 49;
    ctx.beginPath(); ctx.roundRect(width / 2 - barWidth / 2 - 12, y - 9, barWidth + 24, panelHeight, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffd18a"; ctx.font = "800 12px 'Microsoft YaHei UI', sans-serif";
    const resistanceNames = { frost: "冰霜", fire: "火焰", lightning: "雷电" };
    const anchors = state.enemies.filter((enemy) => enemy.type === "anchor" && enemy.anchorBossId === boss.id && enemy.hp > 0);
    const anchorSummary = anchors.map((anchor) => ANCHOR_VISUALS[anchor.anchorRole]?.name ?? "未知").join("/") || "全毁";
    const colossusAffix = COLOSSUS_AFFIXES[boss.colossusAffix] ?? { name: "未知异变" };
    const parallelSkills = Object.keys(boss.activeSkills ?? {}).map((skill) => COLOSSUS_SKILLS[skill]?.name).filter(Boolean);
    const colossusAction = boss.intentSkill
      ? `预兆:${COLOSSUS_SKILLS[boss.intentSkill]?.name} ${Math.max(0, boss.intentTimer).toFixed(1)}s`
      : parallelSkills.length ? parallelSkills.join(" + ") : COLOSSUS_SKILLS[boss.activeSkill]?.name ?? "技能间隙";
    const title = isColossus
      ? `虚环吞星兽 · ${colossusAffix.name} · ${boss.enraged ? `狂暴并行 · ${colossusAction}` : colossusAction}`
      : `腐化晶核领主 · ${resistanceNames[boss.resistance] ?? "未知"}抗性 · ${anchorSummary}`;
    ctx.fillText(title, width / 2, y + 5);
    const phaseColor = isColossus ? (boss.enraged ? "#ff4a2f" : COLOSSUS_AFFIXES[boss.colossusAffix]?.color ?? "#ff477c") : { frost: "#62dfff", fire: "#ff6749", lightning: "#aa83ff" }[boss.resistance] ?? "#ff4d67";
    const gradient = ctx.createLinearGradient(width / 2 - barWidth / 2, 0, width / 2 + barWidth / 2, 0);
    gradient.addColorStop(0, phaseColor); gradient.addColorStop(1, "#ffc45f");
    if (isColossus) {
      const x = width / 2 - barWidth / 2;
      const shieldRatio = Math.max(0, (boss.spawnShield ?? 0) / (boss.spawnShieldMax || 1));
      ctx.fillStyle = "rgba(103,220,255,.13)"; ctx.fillRect(x, y + 13, barWidth, 4);
      ctx.fillStyle = "#8eeeff"; ctx.shadowColor = "#4cb9ff"; ctx.shadowBlur = 7; ctx.fillRect(x, y + 13, barWidth * shieldRatio, 4); ctx.shadowBlur = 0;
      const barRatios = boss.healthBar >= 2 ? [ratio, 1] : [0, ratio];
      ["Ⅱ", "Ⅰ"].forEach((label, index) => {
        const barY = y + 22 + index * 14;
        ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(x, barY, barWidth, 9);
        ctx.fillStyle = gradient; ctx.fillRect(x, barY, barWidth * barRatios[index], 9);
        ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = "800 9px ui-monospace, monospace"; ctx.fillText(label, x + 5, barY + 8);
      });
      ctx.textAlign = "center"; ctx.font = "700 10px 'Microsoft YaHei UI', sans-serif";
      ctx.fillStyle = shieldRatio > 0 ? "#a9f4ff" : boss.enraged ? "#ff9c71" : "#ddc6ff";
      const status = shieldRatio > 0 ? `腐晶护盾 ${Math.ceil(shieldRatio * 100)}%` : (boss.exposedTimer ?? 0) > 0 ? `弱点暴露 · 承伤 +${Math.round((GAME_CONFIG.colossus.counters.exposedDamageMultiplier - 1) * 100)}% · ${boss.exposedTimer.toFixed(1)}s` : boss.enraged ? `第二命核 · 冰冻免疫 · ${parallelSkills.length} 项技能并行` : "双生命核 · 第一阶段";
      ctx.fillText(status, width / 2, y + 55);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(width / 2 - barWidth / 2, y + 14, barWidth, 10);
      ctx.fillStyle = gradient; ctx.fillRect(width / 2 - barWidth / 2, y + 14, barWidth * ratio, 10);
    }
    ctx.restore();
  }

  drawVignette(ctx, state) {
    const stats = getTowerStats(state);
    const hpRatio = Math.max(0, state.tower.hp / stats.maxHp);
    if (hpRatio > 0.4) return;
    const { width, height, centerX, centerY } = GAME_CONFIG.arena;
    const gradient = ctx.createRadialGradient(centerX, centerY, 180, centerX, centerY, 570);
    gradient.addColorStop(0, "rgba(90,5,40,0)"); gradient.addColorStop(1, `rgba(120,6,38,${(0.4 - hpRatio) * 1.1})`);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  }
}
