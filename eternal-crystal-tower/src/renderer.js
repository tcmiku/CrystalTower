import { GAME_CONFIG, getArenaEdgePosition, getCrowdVisualScale } from "./config.js";
import { getChapterTwoDroneAmmoMax, getDroneDetonateRecovery, getDroneEnergyMax, getDroneGuardShieldMax, getDronePosition, getSawBladeRadius, getSawOrbitRadius, getStarfallConeHalfAngle, getTowerPosition, getTowerRadius, getTowerStats } from "./engine.js";
import { isChapterTwo } from "./chapter-two.js";

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
  sovereign: ["#ff345f", "#18091f"],
  anchor: ["#d9c8ff", "#38255d"],
  inkHound: ["#39e8ff", "#07192b"],
  orbitMote: ["#d9f5ff", "#25204a"],
  rustBeetle: ["#b9ff4a", "#3a241c"],
  porcelainWarden: ["#8db7ff", "#161d3a"]
};
const ASTRAL_ENEMY_TYPES = new Set(["inkHound", "orbitMote", "rustBeetle", "porcelainWarden"]);
const CHAPTER_TWO_ENEMY_CELLS = {
  wisp: [0, 0], runner: [0, 0], inkHound: [0, 0],
  brute: [1, 0], sentinel: [1, 0], rammer: [1, 0], rustBeetle: [1, 0], porcelainWarden: [1, 0],
  hexer: [0, 1], orbitMote: [0, 1],
  crawler: [1, 1]
};
const ENEMY_ATLAS_CELLS = {
  wisp: [0, 0], runner: [1, 0], brute: [0, 1], boss: [1, 1],
  crawler: [0, 0], sentinel: [1, 0], hexer: [0, 0], rammer: [0, 1],
  inkHound: [0, 0], orbitMote: [1, 0], rustBeetle: [0, 1], porcelainWarden: [1, 1]
};
const TOWER_ART_SCALE = 1.08;
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

export function getCombatViewport(width, height, layout = {}) {
  const desktopDeck = globalThis.matchMedia?.("(min-width: 1181px)")?.matches ?? width >= 1155;
  const shell = globalThis.document?.querySelector?.(".game-shell");
  const sidePanelCollapsed = layout.sidePanelCollapsed ?? shell?.classList.contains("side-panel-collapsed") ?? false;
  const skillBarCollapsed = layout.skillBarCollapsed ?? globalThis.document?.getElementById?.("skillBar")?.classList.contains("is-collapsed") ?? false;
  const rightInset = desktopDeck ? Math.min(sidePanelCollapsed ? 82 : 268, width * 0.35) : 0;
  const bottomInset = desktopDeck && !skillBarCollapsed ? Math.min(104, height * 0.28) : 0;
  return {
    x: 0,
    y: 0,
    width: Math.max(1, width - rightInset),
    height: Math.max(1, height - bottomInset),
    rightInset,
    bottomInset
  };
}

export function getCoverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight, focusX = 0.5, focusY = 0.5) {
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  const safeTargetWidth = Math.max(1, targetWidth);
  const safeTargetHeight = Math.max(1, targetHeight);
  const sourceAspect = safeSourceWidth / safeSourceHeight;
  const targetAspect = safeTargetWidth / safeTargetHeight;
  let width = safeSourceWidth;
  let height = safeSourceHeight;
  if (targetAspect > sourceAspect) height = safeSourceWidth / targetAspect;
  else width = safeSourceHeight * targetAspect;
  return {
    x: Math.max(0, Math.min(safeSourceWidth - width, (safeSourceWidth - width) * focusX)),
    y: Math.max(0, Math.min(safeSourceHeight - height, (safeSourceHeight - height) * focusY)),
    width,
    height
  };
}

const GENERATED_ASSETS = {
  arena: "./assets/generated/arena-bg-safe-zone-v5.png",
  arenaDay: "./assets/generated/arena-bg-safe-zone-v5.png",
  tower: "./assets/generated/tower-body-tiers-ai-v2.png",
  towerRouteSiege: "./assets/generated/tower-route-siege-ai-v1.png",
  towerRouteSplit: "./assets/generated/tower-route-split-ai-v1.png",
  towerShellPanels: "./assets/generated/tower-shell-panels-ai-v1.png",
  towerMainCannonTiers: "./assets/generated/tower-main-cannon-tiers-ai-v2.png",
  enemies: "./assets/generated/enemy-atlas.png",
  waveEnemies: "./assets/generated/enemy-wave-atlas.png",
  astralEnemies: "./assets/generated/enemy-astral-atlas-ai.png",
  boss: "./assets/generated/boss-overlord.png",
  colossus: "./assets/generated/boss-void-ring-colossus.png",
  sovereign: "./assets/generated/boss-rift-sovereign-ai.png",
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
  coreFragment: "./assets/generated/resource-core-fragment-ai.png",
  chapterTwoArena: "./assets/generated/chapter2-polar-sea-ai-v1.png",
  chapterTwoArenaForeground: "./assets/generated/chapter2-polar-sea-foreground-ai-v3.png",
  chapterTwoCarrier: "./assets/generated/chapter2-hive-carrier-ai-v1.png",
  chapterTwoEnemies: "./assets/generated/chapter2-enemy-fleet-atlas-ai-v1.png",
  chapterTwoDrones: "./assets/generated/chapter2-drone-atlas-ai-v1.png",
  chapterTwoSovereign: "./assets/generated/chapter2-abyss-sovereign-ai-v1.png"
};

const CRITICAL_ASSET_KEYS = new Set(["arena", "tower", "enemies"]);

const CUTOUT_ASSETS = new Set([
  "projectileFrost", "projectileLightning", "moduleFrost",
  "effectFrost", "effectFire", "effectLightning"
]);

export function getTowerVisualState(state) {
  const tower = state?.tower ?? {};
  const upgrades = tower.upgrades ?? {};
  const stats = state ? getTowerStats(state) : { maxHp: 1 };
  const hpRatio = Math.max(0, Math.min(1, Number(tower.hp ?? 0) / Math.max(1, stats.maxHp)));
  const heatThreshold = Math.max(1, GAME_CONFIG.skills.overload.overheatThreshold);
  const heatRatio = Math.max(0, Math.min(1.25, Number(state?.skills?.overload?.heat ?? 0) / heatThreshold));
  const shieldCap = Math.max(1, stats.maxHp * GAME_CONFIG.skills.heal.shieldCapFraction);
  const shieldRatio = Math.max(0, Math.min(1, Number(tower.shield ?? 0) / shieldCap));
  const overloadActive = Number(state?.skills?.overload?.active ?? 0) > 0 || state?.skills?.overload?.permanentEngaged === true;
  return {
    tier: Math.max(0, Math.min(3, Number(upgrades.ascend ?? 0))),
    hpRatio,
    damageBand: hpRatio < 0.15 ? "collapse" : hpRatio < 0.40 ? "critical" : hpRatio < 0.70 ? "damaged" : "intact",
    cannonRoute: upgrades.cannonSiege > 0 ? "siege" : upgrades.cannonSplit > 0 ? "split" : "none",
    elements: { frost: upgrades.frost > 0, fire: upgrades.fire > 0, lightning: upgrades.lightning > 0 },
    ultimate: Number(upgrades.ascend ?? 0) >= 3,
    overloadBand: !overloadActive ? "off" : heatRatio >= 1 ? "overheated" : heatRatio >= 0.5 ? "hot" : "charged",
    starfallBand: Number(state?.skills?.starfall?.active ?? 0) > 0 ? "release" : state?.skills?.starfall?.aiming ? "aiming" : "off",
    shieldBand: state?.skills?.heal?.shieldBurstArmed ? "armed" : shieldRatio >= 0.999 ? "full" : shieldRatio > 0 ? "partial" : "none"
  };
}
export function getTowerAimTarget(state) {
  if (!state?.tower || !Array.isArray(state.enemies)) return null;
  const priorityIds = state.tower.priorityTargetIds ?? [];
  const position = getTowerPosition(state);
  const rangeSquared = getTowerStats(state).range ** 2;
  let priorityTarget = null;
  let priorityIndex = Number.POSITIVE_INFINITY;
  let lockedTarget = null;
  let nearestTarget = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const index = priorityIds.indexOf(enemy.id);
    if (index >= 0 && index < priorityIndex) {
      priorityTarget = enemy;
      priorityIndex = index;
    }
    if (enemy.id === state.tower.siegeTargetId) lockedTarget = enemy;
    const dx = enemy.x - position.x;
    const dy = enemy.y - position.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared <= rangeSquared && (!nearestTarget || distanceSquared < nearestDistanceSquared || (distanceSquared === nearestDistanceSquared && enemy.id < nearestTarget.id))) {
      nearestTarget = enemy;
      nearestDistanceSquared = distanceSquared;
    }
  }
  return priorityTarget ?? lockedTarget ?? nearestTarget;
}

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
  const criticalEntries = entries.filter(([key]) => CRITICAL_ASSET_KEYS.has(key));
  const deferredEntries = entries.filter(([key]) => !CRITICAL_ASSET_KEYS.has(key));
  const loadAsset = ([key, src], reportProgress = false) => new Promise((resolve) => {
    if (assets[key]) return resolve({ key, ok: imageReady(assets[key]) });
    const image = new Image();
    image.decoding = "async";
    if (CUTOUT_ASSETS.has(key)) {
      image.addEventListener("load", () => {
        image.cutout = removeConnectedLightBackground(image, key === "effectFrost" || key === "effectFire");
      }, { once: true });
    }
    const settle = (ok) => {
      if (reportProgress) {
        completed += 1;
        if (!ok) failed += 1;
        onProgress({ completed, total: criticalEntries.length, failed });
      }
      resolve({ key, ok });
    };
    image.addEventListener("load", () => settle(true), { once: true });
    image.addEventListener("error", () => settle(false), { once: true });
    image.src = src;
    assets[key] = image;
  });
  const ready = Promise.all(criticalEntries.map((entry) => loadAsset(entry, true))).then((results) => {
    const loadDeferred = () => { deferredEntries.forEach((entry) => { void loadAsset(entry); }); };
    const scheduleDeferred = () => {
      if (typeof requestIdleCallback === "function") requestIdleCallback(loadDeferred, { timeout: 1_500 });
      else setTimeout(loadDeferred, 250);
    };
    if (document.readyState === "complete") scheduleDeferred();
    else window.addEventListener("load", scheduleDeferred, { once: true });
    return results;
  });
  return { assets, ready };
}

function imageReady(image) {
  return Boolean(image?.complete && image.naturalWidth > 0);
}

function createEffectCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function createStarfallFxSprites() {
  const beam = createEffectCanvas(96, 256);
  const impact = createEffectCanvas(128, 128);
  if (!beam || !impact) return { beam: null, impact: null };

  const beamCtx = beam.getContext("2d");
  beamCtx.lineCap = "round";
  for (const [lineWidth, color, alpha, blur] of [[18, "#845cff", .18, 18], [9, "#d5b1ff", .52, 12], [3, "#fff1ad", 1, 5]]) {
    beamCtx.globalAlpha = alpha;
    beamCtx.strokeStyle = color;
    beamCtx.shadowColor = color;
    beamCtx.shadowBlur = blur;
    beamCtx.lineWidth = lineWidth;
    beamCtx.beginPath();
    beamCtx.moveTo(19, 14);
    beamCtx.lineTo(72, 240);
    beamCtx.stroke();
  }

  const impactCtx = impact.getContext("2d");
  const blast = impactCtx.createRadialGradient(64, 64, 0, 64, 64, 60);
  blast.addColorStop(0, "rgba(255,255,226,.98)");
  blast.addColorStop(.24, "rgba(255,207,100,.72)");
  blast.addColorStop(.58, "rgba(172,113,255,.28)");
  blast.addColorStop(1, "rgba(127,72,255,0)");
  impactCtx.fillStyle = blast;
  impactCtx.fillRect(0, 0, 128, 128);
  impactCtx.strokeStyle = "rgba(255,234,158,.9)";
  impactCtx.lineWidth = 3;
  impactCtx.beginPath();
  impactCtx.arc(64, 64, 34, 0, Math.PI * 2);
  impactCtx.stroke();
  return { beam, impact };
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
    this.starfallFx = createStarfallFxSprites();
    this.starfallCorridors = new Map();
    this.towerFx = { ascend: 0, heal: 0, overload: 0, starfall: 0, coinVacuum: 0, hit: 0, shoot: 0 };
    this.towerAimAngle = -Math.PI / 2;
    this.towerAimTargetId = null;
    this.towerAimTarget = null;
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
    if (type === "ascend") this.towerFx.ascend = Math.max(this.towerFx.ascend, 1.35);
    if (type === "heal" || type === "shieldBurst") this.towerFx.heal = Math.max(this.towerFx.heal, 1.1);
    if (type === "overload") this.towerFx.overload = Math.max(this.towerFx.overload, 1.2);
    if (type === "starfall") this.towerFx.starfall = Math.max(this.towerFx.starfall, 1.1);
    if (type === "coinVacuum") this.towerFx.coinVacuum = Math.max(this.towerFx.coinVacuum, 1.1);
    if (type === "towerHit") this.towerFx.hit = Math.max(this.towerFx.hit, 0.35);
    if (type === "shoot") this.towerFx.shoot = Math.max(this.towerFx.shoot, 0.28);
    if (type === "towerHit") { this.shake = Math.max(this.shake, 3.5 * strength); this.flash = Math.max(this.flash, 0.09); this.flashColor = "#ff4f70"; }
    if (type === "ascend") { this.shake = 7; this.flash = 0.42; this.flashColor = "#9ff8ff"; }
    if (type === "starfall") { this.shake = 9; this.flash = 0.48; this.flashColor = "#fff2b8"; }
    if (type === "overloadRelease") { this.shake = Math.max(this.shake, 6 * strength); this.flash = Math.max(this.flash, .22 * strength); this.flashColor = strength > 1 ? "#ff704d" : "#d6b0ff"; }
    if (type === "shieldBurst") { this.shake = Math.max(this.shake, 7); this.flash = Math.max(this.flash, .28); this.flashColor = "#bafaff"; }
    if (type === "anchorLocked") { this.flash = Math.max(this.flash, .1); this.flashColor = "#fff0a8"; }
    if (type === "coinVacuum") { this.shake = Math.max(this.shake, 3); this.flash = Math.max(this.flash, .22); this.flashColor = "#ffe68a"; }
    if (type === "bossSpawn") { this.shake = Math.max(this.shake, 8 * strength); this.flash = Math.max(this.flash, 0.25 * strength); this.flashColor = "#ff6b72"; }
    if (type === "eliteSpawn") { this.shake = Math.max(this.shake, 4); this.flash = Math.max(this.flash, 0.14); this.flashColor = "#ffd35f"; }
    if (type === "collectPulse") { this.flash = Math.max(this.flash, 0.08); this.flashColor = "#ffe09a"; }
    if (type === "targetProtocol") { this.flash = Math.max(this.flash, 0.06); this.flashColor = "#7ceeff"; }
    if (type === "droneDepleted") { this.flash = Math.max(this.flash, 0.13); this.flashColor = "#ff8a5c"; }
    if (type === "droneIntercept") { this.shake = Math.max(this.shake, 4); this.flash = Math.max(this.flash, 0.18); this.flashColor = "#a8f8ff"; }
    if (type === "droneDetonate") { this.shake = Math.max(this.shake, 8); this.flash = Math.max(this.flash, 0.32); this.flashColor = "#ff8468"; }
    if (type === "droneGuardDepleted") { this.flash = Math.max(this.flash, 0.16); this.flashColor = "#b39aff"; }
    if (type === "eliteMarked") { this.flash = Math.max(this.flash, 0.07); this.flashColor = "#ff6fcf"; }
    if (type === "cannonWeakpoint") { this.flash = Math.max(this.flash, 0.1); this.flashColor = "#fff0a8"; }
    if (type === "cannonSplit") { this.flash = Math.max(this.flash, 0.06); this.flashColor = "#d5b3ff"; }
    if (type === "cannonEcho") { this.shake = Math.max(this.shake, 0.65); }
    if (type === "cannonStarPiercer") { this.shake = Math.max(this.shake, 8); this.flash = Math.max(this.flash, 0.3); this.flashColor = "#fff0a0"; }
    if (type === "cannonCascade") {
      // Previous baseline was Math.max(this.shake, 2.5); the cascade now uses a
      // restrained pulse so repeated chain reactions do not jolt the whole view.
      this.shake = Math.max(this.shake, 1.2);
      // Keep the impact localized to the world effect; no full-screen white flash.
    }
    if (type === "sawStorm") { this.shake = Math.max(this.shake, 2.1 * strength); this.flash = Math.max(this.flash, .08); this.flashColor = "#ffe39a"; }
    if (type === "sawHomecoming") { this.shake = Math.max(this.shake, 3.2 * strength); this.flash = Math.max(this.flash, .13); this.flashColor = "#9af5ff"; }
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
    const viewport = getCombatViewport(cssWidth, cssHeight);
    const scale = Math.min(viewport.width / logical.width, viewport.height / logical.height);
    const offsetX = viewport.x + (viewport.width - logical.width * scale) / 2;
    const offsetY = viewport.y + (viewport.height - logical.height * scale) / 2;
    this.time += delta;
    for (const key of Object.keys(this.towerFx)) this.towerFx[key] = Math.max(0, this.towerFx[key] - delta);
    const aimTarget = getTowerAimTarget(state);
    const towerPosition = getTowerPosition(state);
    if (aimTarget) {
      const desiredAngle = Math.atan2(aimTarget.y - towerPosition.y, aimTarget.x - towerPosition.x);
      const deltaAngle = Math.atan2(Math.sin(desiredAngle - this.towerAimAngle), Math.cos(desiredAngle - this.towerAimAngle));
      this.towerAimAngle += deltaAngle * Math.min(1, delta * 12);
      this.towerAimTargetId = aimTarget.id;
      this.towerAimTarget = aimTarget;
    } else {
      this.towerAimTargetId = null;
      this.towerAimTarget = null;
    }
    const targetDayMix = state.phase === "day" ? 1 : 0;
    this.dayMix += (targetDayMix - this.dayMix) * Math.min(1, delta * 0.42);
    this.shake = Math.max(0, this.shake - delta * 16);
    this.flash = Math.max(0, this.flash - delta * 1.7);
    const shakeX = this.shake ? Math.sin(this.time * 77) * this.shake : 0;
    const shakeY = this.shake ? Math.cos(this.time * 61) * this.shake * 0.7 : 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawBackdrop(ctx, state, cssWidth, cssHeight);
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

  drawBackdrop(ctx, state, width, height) {
    if (isChapterTwo(state)) {
      if (imageReady(this.assets.chapterTwoArenaForeground)) {
        this.drawChapterTwoWater(ctx, state, width, height);
        const foreground = this.assets.chapterTwoArenaForeground;
        const crop = getCoverCrop(foreground.naturalWidth, foreground.naturalHeight, width, height, .5, .5);
        ctx.drawImage(foreground, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
        return;
      }
      if (imageReady(this.assets.chapterTwoArena)) {
        const arena = this.assets.chapterTwoArena;
        const crop = getCoverCrop(arena.naturalWidth, arena.naturalHeight, width, height, .5, .5);
        ctx.drawImage(arena, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
        return;
      }
      this.drawChapterTwoWater(ctx, state, width, height);
      return;
    }
    const arenaReady = imageReady(this.assets.arena);
    const arenaDayReady = imageReady(this.assets.arenaDay);
    if (arenaReady || arenaDayReady) {
      const arena = arenaReady ? this.assets.arena : this.assets.arenaDay;
      const arenaDay = arenaDayReady ? this.assets.arenaDay : arena;
      const drawCover = (image) => {
        const crop = getCoverCrop(image.naturalWidth || image.width, image.naturalHeight || image.height, width, height, 0.4, 0.42);
        ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
      };
      const sameBackdrop = arena === arenaDay || arena.src === arenaDay.src;
      if (sameBackdrop || this.dayMix <= 0.001) {
        drawCover(arena);
      } else if (this.dayMix >= 0.999) {
        drawCover(arenaDay);
      } else {
        drawCover(arena);
        ctx.globalAlpha = this.dayMix;
        drawCover(arenaDay);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = state.skills.overload.active > 0 || state.skills.overload.permanentEngaged ? "rgba(21,7,56,.28)" : `rgba(3,5,20,${0.14 + (1 - this.dayMix) * 0.1})`;
      ctx.fillRect(0, 0, width, height);
      return;
    }
    const background = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, Math.max(width, height) * .62);
    background.addColorStop(0, state.skills.overload.active > 0 ? "#21114e" : "#151039");
    background.addColorStop(0.48, "#0b0c25");
    background.addColorStop(1, "#050612");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  drawChapterTwoWater(ctx, state, width, height) {
    const storm = 1 - this.dayMix;
    const sea = ctx.createLinearGradient(0, 0, width, height);
    sea.addColorStop(0, storm > .5 ? "#010813" : "#061c2b");
    sea.addColorStop(.46, storm > .5 ? "#05182a" : "#0a3042");
    sea.addColorStop(1, "#02111d");
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, width, height);

    const depth = ctx.createRadialGradient(width * .5, height * .48, 20, width * .5, height * .48, Math.max(width, height) * .62);
    depth.addColorStop(0, "rgba(3,20,34," + (.18 + storm * .12) + ")");
    depth.addColorStop(.6, "rgba(8,58,72,.08)");
    depth.addColorStop(1, "rgba(0,3,10,.34)");
    ctx.fillStyle = depth;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const layer of [
      { gap: 27, step: 42, speed: .7, amplitude: 3.4 + storm * 2.6, alpha: .12 + storm * .05, color: "#4ec9df" },
      { gap: 43, step: 54, speed: -.42, amplitude: 5.2 + storm * 3.4, alpha: .075 + storm * .035, color: "#8de8ed" }
    ]) {
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = layer.alpha;
      for (let row = -layer.gap; row < height + layer.gap; row += layer.gap) {
        ctx.beginPath();
        for (let x = -layer.step; x <= width + layer.step; x += layer.step) {
          const y = row
            + Math.sin(x * .014 + this.time * layer.speed + row * .031) * layer.amplitude
            + Math.sin(x * .006 - this.time * layer.speed * .53) * 2.1;
          x === -layer.step ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = .12 + storm * .08;
    ctx.fillStyle = "#b5fbff";
    for (const glint of this.stars.slice(0, 22)) {
      const x = (glint.x / GAME_CONFIG.arena.width * width + this.time * (7 + glint.size * 2)) % (width + 30) - 15;
      const y = glint.y / GAME_CONFIG.arena.height * height;
      ctx.fillRect(x, y, 8 + glint.size * 5, .7 + glint.size * .45);
    }
    ctx.restore();

    if (state.skills.overload.active > 0 || state.skills.overload.permanentEngaged) {
      ctx.fillStyle = "rgba(36,10,70,.2)";
      ctx.fillRect(0, 0, width, height);
    }
  }

  drawWorld(ctx, state) {
    this.drawGround(ctx, state);
    this.drawTowerGroundVeins(ctx, state);
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

  drawTowerGroundVeins(ctx, state) {
    if (isChapterTwo(state)) return;
    const visual = getTowerVisualState(state);
    const { x, y } = getTowerPosition(state);
    const tier = visual.tier;
    const routeColor = visual.cannonRoute === "siege" ? "#ffd27a" : visual.cannonRoute === "split" ? "#d9b4ff" : "#79dff5";
    const damageAlpha = visual.damageBand === "collapse" ? 0.28 : visual.damageBand === "critical" ? 0.5 : 1;
    const pulse = 0.78 + Math.sin(this.time * 2.1) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.time * 0.025);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let ring = 0; ring <= tier; ring += 1) {
      const radius = 86 + ring * 43;
      ctx.globalAlpha = (0.12 + tier * 0.025) * damageAlpha * pulse;
      ctx.strokeStyle = routeColor;
      ctx.lineWidth = ring === tier ? 2.4 : 1.2;
      ctx.setLineDash([5 + ring * 2, 13 - Math.min(5, ring)]);
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]);
    const branchCount = 6 + tier * 2;
    for (let branch = 0; branch < branchCount; branch += 1) {
      const angle = branch * Math.PI * 2 / branchCount + (visual.cannonRoute === "split" ? Math.PI / branchCount : 0);
      const inner = 52 + tier * 10;
      const outer = 138 + tier * 38;
      const bend = Math.sin(this.time * 0.65 + branch) * 3;
      ctx.globalAlpha = (0.18 + tier * 0.035) * damageAlpha;
      ctx.strokeStyle = routeColor;
      ctx.lineWidth = branch % 3 === 0 ? 2.2 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.quadraticCurveTo(Math.cos(angle + 0.08) * (inner + outer) * 0.5 + bend, Math.sin(angle + 0.08) * (inner + outer) * 0.5 + bend, Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
      ctx.globalAlpha = (0.3 + tier * 0.04) * damageAlpha;
      ctx.fillStyle = routeColor;
      ctx.beginPath(); ctx.arc(Math.cos(angle) * outer, Math.sin(angle) * outer, branch % 3 === 0 ? 3.2 : 2, 0, Math.PI * 2); ctx.fill();
    }
    if (this.towerFx.coinVacuum > 0) {
      const progress = 1 - this.towerFx.coinVacuum / 1.1;
      ctx.globalAlpha = (1 - progress) * 0.7;
      ctx.strokeStyle = "#ffe68a";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 48 + progress * 170, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  drawGround(ctx, state) {
    const { width, height, centerX, centerY } = GAME_CONFIG.arena;
    const towerPosition = getTowerPosition(state);
    const towerX = towerPosition.x;
    const towerY = towerPosition.y;
    if (isChapterTwo(state)) {
      ctx.save(); ctx.strokeStyle = "rgba(93,224,244,.2)"; ctx.fillStyle = "rgba(156,244,255,.7)"; ctx.lineWidth = 1.5; ctx.font = "800 11px 'Microsoft YaHei UI',sans-serif"; ctx.textAlign = "center";
      for (const [angle, label] of [[-Math.PI / 2, "北部航道"], [0, "东部航道"], [Math.PI / 2, "南部航道"], [Math.PI, "西部航道"]]) {
        const x = centerX + Math.cos(angle) * 310, y = centerY + Math.sin(angle) * 245;
        ctx.setLineDash([8, 9]); ctx.beginPath(); ctx.moveTo(centerX + Math.cos(angle) * 92, centerY + Math.sin(angle) * 72); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillText(label, x, y - 8);
      }
      ctx.restore();
    }
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
      const remaining = 1 - progress;
      const pulse = .5 + Math.sin(this.time * 11) * .5;
      const gatherWave = Math.sin(progress * Math.PI);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const trailSegments = state.skills.coinVacuum.trails.map((trail, index) => {
        const x = trail.x + (towerX - trail.x) * ease;
        const y = trail.y + (towerY - trail.y) * ease;
        const dx = towerX - x;
        const dy = towerY - y;
        const distance = Math.hypot(dx, dy) || 1;
        const sway = Math.sin(this.time * 4.5 + index * 1.67) * (8 + distance * .025) * gatherWave;
        const controlX = (x + towerX) * .5 - (dy / distance) * sway;
        const controlY = (y + towerY) * .5 + (dx / distance) * sway;
        return { x, y, controlX, controlY, index };
      });

      // 将所有轨迹合并为两条路径，减少大量 beginPath/stroke 与阴影状态切换。
      ctx.globalAlpha = .16 + remaining * .32;
      ctx.strokeStyle = "#ffbd43";
      ctx.shadowColor = "#ff9f2f";
      ctx.shadowBlur = 8;
      ctx.lineWidth = 4.6 * remaining + 1.1;
      ctx.beginPath();
      for (const segment of trailSegments) {
        ctx.moveTo(segment.x, segment.y);
        ctx.quadraticCurveTo(segment.controlX, segment.controlY, towerX, towerY);
      }
      ctx.stroke();

      ctx.globalAlpha = .45 + remaining * .4;
      ctx.strokeStyle = "#fff2a8";
      ctx.shadowBlur = 3;
      ctx.lineWidth = 1.2 + remaining * 1.2;
      ctx.beginPath();
      for (const segment of trailSegments) {
        ctx.moveTo(segment.x, segment.y);
        ctx.quadraticCurveTo(segment.controlX, segment.controlY, towerX, towerY);
      }
      ctx.stroke();

      ctx.globalAlpha = remaining * .9;
      ctx.fillStyle = "#fff2a8";
      ctx.shadowColor = "#ffbd43";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (const segment of trailSegments) {
        const coinPulse = 1 + Math.sin(this.time * 13 + segment.index) * .16;
        ctx.moveTo(segment.x + (4.5 * remaining + 1.2) * coinPulse, segment.y);
        ctx.arc(segment.x, segment.y, (4.5 * remaining + 1.2) * coinPulse, 0, Math.PI * 2);
      }
      ctx.fill();
      const coreRadius = 30 + pulse * 6;
      const coreGlow = ctx.createRadialGradient(towerX, towerY, 0, towerX, towerY, coreRadius * 3.2);
      coreGlow.addColorStop(0, `rgba(255,248,188,${.3 * remaining})`);
      coreGlow.addColorStop(.35, `rgba(255,191,67,${.16 * remaining})`);
      coreGlow.addColorStop(1, "rgba(255,155,42,0)");
      ctx.globalAlpha = .9;
      ctx.fillStyle = coreGlow;
      ctx.beginPath(); ctx.arc(towerX, towerY, coreRadius * 3.2, 0, Math.PI * 2); ctx.fill();

      ctx.globalAlpha = remaining * (.42 + pulse * .22);
      ctx.strokeStyle = "#fff1aa";
      ctx.shadowColor = "#ffb52f";
      ctx.shadowBlur = 16;
      ctx.lineWidth = 3.5 - progress * 1.5;
      ctx.beginPath(); ctx.arc(towerX, towerY, 46 + progress * 112, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = remaining * (.22 + pulse * .12);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(towerX, towerY, 66 + progress * 88, 0, Math.PI * 2); ctx.stroke();

      ctx.save();
      ctx.translate(towerX, towerY);
      ctx.rotate(this.time * 1.8);
      ctx.globalAlpha = remaining * (.25 + pulse * .18);
      ctx.strokeStyle = "#ffd76f";
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      for (let segment = 0; segment < 8; segment += 1) {
        const angle = segment * Math.PI / 4;
        ctx.beginPath(); ctx.arc(0, 0, 34 + pulse * 3, angle, angle + .22); ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    }
    if (state.skills.coinVacuum.fireRateBuff > 0) {
      const pulse = .5 + Math.sin(this.time * 9) * .5;
      ctx.save(); ctx.translate(towerX, towerY); ctx.rotate(this.time * 1.5);
      ctx.globalAlpha = .5 + pulse * .22; ctx.strokeStyle = "#ffd76f"; ctx.shadowColor = "#ff9f43"; ctx.shadowBlur = 14; ctx.lineWidth = 2.5; ctx.setLineDash([9, 7]);
      ctx.beginPath(); ctx.arc(0, 0, 67 + pulse * 5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
    if (state.skills.heal.damageReduction > 0) {
      const pulse = .5 + Math.sin(this.time * 7) * .5;
      ctx.save(); ctx.globalAlpha = .34 + pulse * .16; ctx.strokeStyle = "#91f5ff"; ctx.fillStyle = "rgba(76,213,255,.05)"; ctx.shadowColor = "#5adfff"; ctx.shadowBlur = 7; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(towerX, towerY, 74 + pulse * 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }

    if (state.skills.starfall.active > 0 || state.skills.starfall.aiming) this.drawStarfall(ctx, state, towerX, towerY, height);
    if (state.skills.heal.burst > 0) {
      const config = GAME_CONFIG.skills.heal;
      const progress = 1 - state.skills.heal.burst / config.burstDuration;
      ctx.save(); ctx.translate(towerX, towerY); ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = "#bafaff"; ctx.fillStyle = "#eaffff"; ctx.shadowColor = "#72eaff"; ctx.shadowBlur = 16; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 45 + progress * config.burstRadius, 0, Math.PI * 2); ctx.stroke();
      // 批量绘制晶片，避免每个晶片都进行一组 save/restore 与变换。
      const shardCount = 8;
      const distance = 55 + progress * (config.burstRadius - 25);
      ctx.beginPath();
      for (let shard = 0; shard < shardCount; shard += 1) {
        const angle = shard * Math.PI * 2 / shardCount + progress * .35;
        const rotation = progress * 3 + angle;
        const radialX = Math.cos(angle);
        const radialY = Math.sin(angle);
        const tangentX = -radialY;
        const tangentY = radialX;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const addPoint = (localX, localY, move = false) => {
          const rotatedX = localX * cos - localY * sin;
          const rotatedY = localX * sin + localY * cos;
          const pointX = radialX * distance + radialX * rotatedX + tangentX * rotatedY;
          const pointY = radialY * distance + radialY * rotatedX + tangentY * rotatedY;
          if (move) ctx.moveTo(pointX, pointY);
          else ctx.lineTo(pointX, pointY);
        };
        addPoint(9, 0, true); addPoint(-5, -4); addPoint(-2, 5); ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }
    if (state.skills.overload.pulse > 0) {
      const config = GAME_CONFIG.skills.overload;
      const progress = 1 - state.skills.overload.pulse / config.pulseDuration;
      const remaining = 1 - progress;
      const crest = Math.sin(progress * Math.PI);
      const overheated = state.skills.overload.overheated;
      const overloadEnergyColor = overheated ? "#ff7650" : "#c9a6ff";
      const overloadHighlight = overheated ? "#ffd39b" : "#f5e8ff";
      const waveRadius = 45 + progress * config.knockbackRadius;
      ctx.save(); ctx.translate(towerX, towerY); ctx.globalCompositeOperation = "lighter";

      // 脉冲持续时间很短，使用半透明圆面替代每帧创建径向渐变。
      ctx.globalAlpha = remaining * (.07 + crest * .06);
      ctx.fillStyle = overheated ? "#ff683d" : "#b880ff";
      ctx.beginPath(); ctx.arc(0, 0, waveRadius, 0, Math.PI * 2); ctx.fill();

      ctx.globalAlpha = remaining;
      ctx.strokeStyle = overloadEnergyColor; ctx.shadowColor = overloadEnergyColor; ctx.shadowBlur = 8; ctx.lineWidth = 7 - progress * 4;
      ctx.beginPath(); ctx.arc(0, 0, waveRadius, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = remaining * .72;
      ctx.strokeStyle = overloadHighlight; ctx.shadowBlur = 4; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(0, 0, 31 + progress * config.knockbackRadius * .78, 0, Math.PI * 2); ctx.stroke();

      ctx.lineCap = "round";
      const rayCount = 8;
      ctx.globalAlpha = remaining * .37;
      ctx.strokeStyle = overloadEnergyColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let ray = 0; ray < rayCount; ray += 1) {
        if (ray % 3 === 0) continue;
        const angle = ray * Math.PI / 4 + this.time * (overheated ? .22 : -.14);
        const jitter = Math.sin(ray * 2.37 + progress * 15) * 8;
        const inner = Math.max(35, waveRadius - 30 - jitter);
        const outer = waveRadius + 8 + jitter * .35;
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle + .018) * outer, Math.sin(angle + .018) * outer);
      }
      ctx.stroke();
      ctx.globalAlpha = remaining * .59;
      ctx.strokeStyle = overloadHighlight;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let ray = 0; ray < rayCount; ray += 1) {
        if (ray % 3 !== 0) continue;
        const angle = ray * Math.PI / 4 + this.time * (overheated ? .22 : -.14);
        const jitter = Math.sin(ray * 2.37 + progress * 15) * 8;
        const inner = Math.max(35, waveRadius - 30 - jitter);
        const outer = waveRadius + 8 + jitter * .35;
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle + .018) * outer, Math.sin(angle + .018) * outer);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  getStarfallCorridorSprite(coneHalfAngle, aiming) {
    const key = `${aiming ? "aim" : "release"}:${coneHalfAngle.toFixed(3)}`;
    if (this.starfallCorridors.has(key)) return this.starfallCorridors.get(key);
    const radius = 680;
    const padding = 30;
    const originY = Math.ceil(Math.sin(coneHalfAngle) * radius) + padding;
    const canvas = createEffectCanvas(radius + padding * 2, originY * 2);
    if (!canvas) return null;
    const corridorCtx = canvas.getContext("2d");
    corridorCtx.translate(padding, originY);
    const wedge = corridorCtx.createRadialGradient(0, 0, 28, 0, 0, radius);
    wedge.addColorStop(0, "rgba(255,239,169,.58)");
    wedge.addColorStop(.25, "rgba(220,182,255,.27)");
    wedge.addColorStop(.68, "rgba(128,92,255,.13)");
    wedge.addColorStop(1, "rgba(82,52,190,0)");
    corridorCtx.fillStyle = wedge;
    corridorCtx.beginPath();
    corridorCtx.moveTo(0, 0);
    corridorCtx.arc(0, 0, radius, -coneHalfAngle, coneHalfAngle);
    corridorCtx.closePath();
    corridorCtx.fill();
    corridorCtx.strokeStyle = aiming ? "#e7c7ff" : "#fff2b2";
    corridorCtx.shadowColor = aiming ? "#8f63ff" : "#ffc95e";
    corridorCtx.shadowBlur = aiming ? 10 : 14;
    corridorCtx.lineWidth = aiming ? 2.2 : 3.2;
    for (const boundary of [-coneHalfAngle, coneHalfAngle]) {
      corridorCtx.beginPath();
      corridorCtx.moveTo(Math.cos(boundary) * 62, Math.sin(boundary) * 62);
      corridorCtx.lineTo(Math.cos(boundary) * radius, Math.sin(boundary) * radius);
      corridorCtx.stroke();
    }
    corridorCtx.beginPath();
    corridorCtx.arc(0, 0, radius, -coneHalfAngle, coneHalfAngle);
    corridorCtx.stroke();
    const sprite = { canvas, x: padding, y: originY };
    this.starfallCorridors.set(key, sprite);
    return sprite;
  }

  drawStarfall(ctx, state, towerX, towerY, height) {
    const skill = state.skills.starfall;
    const config = GAME_CONFIG.skills.starfall;
    const aiming = skill.aiming;
    const angle = aiming ? skill.aimAngle : skill.angle;
    const coneHalfAngle = getStarfallConeHalfAngle(state);
    const radius = 680;
    const pulse = .5 + Math.sin(this.time * 7) * .5;
    const releaseProgress = aiming ? 0 : Math.max(0, Math.min(1, 1 - skill.active / config.activeDuration));
    const releaseAlpha = aiming ? 1 : Math.max(0, 1 - releaseProgress * .72);

    if (!aiming && skill.protocol === "global") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const arenaWidth = GAME_CONFIG.arena.width;
      const arenaHeight = GAME_CONFIG.arena.height;
      const arenaCenterX = arenaWidth / 2;
      const arenaCenterY = arenaHeight / 2;
      const globalPulse = Math.sin(releaseProgress * Math.PI);
      const aperture = Math.min(1, releaseProgress * 3.2);
      const collapse = Math.min(1, Math.max(0, (releaseProgress - .58) / .42));
      ctx.fillStyle = `rgba(126,83,255,${(0.08 + globalPulse * .1) * releaseAlpha})`;
      ctx.fillRect(0, 0, GAME_CONFIG.arena.width, GAME_CONFIG.arena.height);

      // A brief orbital aperture makes the protocol read as a battlefield-wide
      // override rather than a larger directional cone.
      ctx.save();
      ctx.translate(arenaCenterX, arenaCenterY);
      ctx.rotate(this.time * .32);
      ctx.globalAlpha = (.24 + globalPulse * .46) * releaseAlpha;
      ctx.lineWidth = 2.5;
      for (let ring = 0; ring < 4; ring += 1) {
        const radiusRing = 95 + aperture * 470 + ring * 23;
        ctx.strokeStyle = ring % 2 ? "#c396ff" : "#fff0ad";
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 16;
        ctx.setLineDash([18 + ring * 4, 10 + ring * 2]);
        ctx.beginPath(); ctx.arc(0, 0, radiusRing, ring * .7, Math.PI * 2 - ring * .32); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = (.16 + globalPulse * .18) * releaseAlpha;
      ctx.strokeStyle = "#9b76ff"; ctx.lineWidth = 1.2;
      for (let ray = 0; ray < 16; ray += 1) {
        const rayAngle = ray * Math.PI * 2 / 16 + this.time * .08;
        const rayLength = 130 + aperture * 520;
        ctx.beginPath(); ctx.moveTo(Math.cos(rayAngle) * 68, Math.sin(rayAngle) * 68); ctx.lineTo(Math.cos(rayAngle) * rayLength, Math.sin(rayAngle) * rayLength); ctx.stroke();
      }
      ctx.restore();

      // The center shock ring peaks after the first impacts and contracts as
      // the full-screen barrage resolves.
      ctx.save();
      ctx.globalAlpha = (globalPulse * .72 + collapse * .22) * releaseAlpha;
      ctx.strokeStyle = "#fff4bf"; ctx.shadowColor = "#9d68ff"; ctx.shadowBlur = 22; ctx.lineWidth = 5 - collapse * 2.5;
      ctx.beginPath(); ctx.arc(arenaCenterX, arenaCenterY, 38 + aperture * 570, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha *= .45; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(arenaCenterX, arenaCenterY, 72 + aperture * 470, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      const living = state.enemies.filter((enemy) => enemy.hp > 0).slice(0, 36);
      living.forEach((enemy, index) => {
        const fall = Math.max(0, Math.min(1, (releaseProgress + .12 - (index % 9) * .028) / .34));
        if (fall <= 0) return;
        const enemyAngle = Math.atan2(enemy.y - arenaCenterY, enemy.x - arenaCenterX);
        const sourceRadius = 560 + (index % 5) * 42;
        const sourceX = arenaCenterX + Math.cos(enemyAngle) * sourceRadius;
        const sourceY = arenaCenterY + Math.sin(enemyAngle) * sourceRadius;
        const headX = sourceX + (enemy.x - sourceX) * fall;
        const headY = sourceY + (enemy.y - sourceY) * fall;
        ctx.globalAlpha = (1 - releaseProgress * .62) * (.56 + fall * .42) * releaseAlpha;
        ctx.strokeStyle = index % 2 ? "#d8b9ff" : "#fff0a6";
        ctx.shadowColor = "#9d68ff"; ctx.shadowBlur = 12; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(sourceX, sourceY); ctx.lineTo(headX, headY); ctx.stroke();
        ctx.strokeStyle = "#fff8d2"; ctx.shadowBlur = 5; ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.moveTo(sourceX, sourceY); ctx.lineTo(headX, headY); ctx.stroke();
        ctx.globalAlpha = (1 - releaseProgress * .68) * releaseAlpha;
        ctx.strokeStyle = index % 2 ? "#c79aff" : "#ffe89c"; ctx.lineWidth = 2.2; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius + 10 + fall * 17, 0, Math.PI * 2); ctx.stroke();
        ctx.save(); ctx.translate(headX, headY); ctx.rotate(enemyAngle + Math.PI / 2);
        ctx.fillStyle = "#fff8ce"; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4, 0); ctx.lineTo(0, 7); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill(); ctx.restore();
      });
      ctx.restore();
      return;
    }

    // Directional orbital corridor: a quieter purple field supports crisp gold
    // boundaries so the player can read the actual hit sector at a glance.
    ctx.save();
    ctx.translate(towerX, towerY);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "lighter";
    const corridor = this.getStarfallCorridorSprite(coneHalfAngle, aiming);
    ctx.globalAlpha = aiming ? .8 + pulse * .08 : .82 * releaseAlpha;
    if (corridor) ctx.drawImage(corridor.canvas, -corridor.x, -corridor.y);
    else {
      ctx.fillStyle = "rgba(173,130,255,.18)";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius, -coneHalfAngle, coneHalfAngle); ctx.closePath(); ctx.fill();
    }

    // Moving scan bands make aiming feel active without hiding enemies.
    ctx.lineWidth = 1.25;
    ctx.shadowBlur = 0;
    for (let lane = aiming ? -2 : 1; lane <= (aiming ? 2 : 0); lane += 1) {
      const laneRatio = lane / 2;
      const laneAngle = laneRatio * coneHalfAngle * .82;
      const travel = 300 + ((this.time * 115 + (lane + 4) * 61) % 330);
      ctx.globalAlpha = (.2 + pulse * .14) * (1 - Math.abs(laneRatio) * .28);
      ctx.strokeStyle = lane % 2 ? "#b88cff" : "#ffe4a0";
      ctx.beginPath();
      ctx.moveTo(Math.cos(laneAngle) * 92, Math.sin(laneAngle) * 92);
      ctx.lineTo(Math.cos(laneAngle) * travel, Math.sin(laneAngle) * travel);
      ctx.stroke();
    }

    if (aiming) {
      const lockDistance = 430 + Math.sin(this.time * 4) * 7;
      ctx.translate(lockDistance, 0);
      ctx.rotate(-this.time * .8);
      ctx.globalAlpha = .72 + pulse * .2;
      ctx.strokeStyle = "#ffe8a3";
      ctx.shadowColor = "#a66cff";
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2.4;
      ctx.setLineDash([10, 7]);
      ctx.beginPath(); ctx.arc(0, 0, 42 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      for (let corner = 0; corner < 4; corner += 1) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(28, -10); ctx.lineTo(39, -10); ctx.lineTo(39, 10); ctx.stroke();
      }
      ctx.fillStyle = "#fff8d0";
      ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    if (aiming) {
      // Bracket a limited number of valid targets to communicate the true cone
      // selection without turning dense waves into an unreadable glow cloud.
      const lockedTargets = state.enemies
        .filter((enemy) => {
          if (enemy.hp <= 0) return false;
          const enemyAngle = Math.atan2(enemy.y - towerY, enemy.x - towerX);
          return Math.abs(Math.atan2(Math.sin(enemyAngle - angle), Math.cos(enemyAngle - angle))) <= coneHalfAngle;
        })
        .sort((a, b) => Math.hypot(a.x - towerX, a.y - towerY) - Math.hypot(b.x - towerX, b.y - towerY))
        .slice(0, 18);
      for (const enemy of lockedTargets) {
        const lockRadius = enemy.radius + 10 + pulse * 3;
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(this.time * 1.1);
        ctx.globalAlpha = .58 + pulse * .22; ctx.strokeStyle = "#ffe59a"; ctx.shadowColor = "#9d68ff"; ctx.shadowBlur = 10; ctx.lineWidth = 1.8;
        ctx.setLineDash([7, 6]); ctx.beginPath(); ctx.arc(0, 0, lockRadius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        for (let corner = 0; corner < 4; corner += 1) { ctx.rotate(Math.PI / 2); ctx.fillStyle = "#fff4bc"; ctx.fillRect(lockRadius - 2, -2, 7, 4); }
        ctx.restore();
      }
      ctx.save();
      const hintY = Math.min(height - 130, towerY + 205);
      ctx.textAlign = "center"; ctx.fillStyle = "#ffedb2"; ctx.font = "900 13px 'Microsoft YaHei UI', sans-serif"; ctx.shadowColor = "#3b1424"; ctx.shadowBlur = 8;
      ctx.fillText(`轨道已锁定 ${lockedTargets.length} 个目标 · 点击释放 · Esc 取消`, towerX, hintY);
      ctx.restore();
      return;
    }

    // Staggered orbital lances land across the selected sector. Their impact
    // points are deterministic, keeping replays visually stable.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const strikeCount = 7;
    for (let strike = 0; strike < strikeCount; strike += 1) {
      const laneRatio = ((strike * 5) % strikeCount) / (strikeCount - 1) * 2 - 1;
      const strikeAngle = angle + laneRatio * coneHalfAngle * .78;
      const distance = 205 + ((strike * 83) % 390);
      const impactX = towerX + Math.cos(strikeAngle) * distance;
      const impactY = towerY + Math.sin(strikeAngle) * distance;
      const delay = strike * .042;
      const fall = Math.max(0, Math.min(1, (releaseProgress + .06 - delay) / .34));
      if (fall <= 0) continue;
      const eased = 1 - (1 - fall) ** 3;
      const headX = impactX - (1 - eased) * 92;
      const headY = impactY - (1 - eased) * 235;
      const trailLength = 58 + fall * 54;
      const streakAlpha = Math.sin(Math.min(1, fall) * Math.PI) * .9 + .1;
      if (this.starfallFx.beam) {
        ctx.globalAlpha = streakAlpha * releaseAlpha;
        ctx.drawImage(this.starfallFx.beam, headX - 34, headY - trailLength, 48, trailLength + 8);
      } else {
        ctx.globalAlpha = streakAlpha * releaseAlpha;
        ctx.strokeStyle = "#fff1ad"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(headX - trailLength * .36, headY - trailLength); ctx.lineTo(headX, headY); ctx.stroke();
      }
      ctx.globalAlpha = Math.min(1, fall * 2) * releaseAlpha;
      ctx.fillStyle = "#fffbd8"; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(headX, headY, 4 + fall * 3, 0, Math.PI * 2); ctx.fill();

      if (fall > .68) {
        const impact = Math.min(1, (fall - .68) / .32);
        const impactAlpha = (1 - impact) * releaseAlpha;
        if (this.starfallFx.impact) {
          const spriteSize = 82 + impact * 46;
          ctx.globalAlpha = impactAlpha * .92;
          ctx.drawImage(this.starfallFx.impact, impactX - spriteSize / 2, impactY - spriteSize / 2, spriteSize, spriteSize);
        }
        ctx.globalAlpha = impactAlpha; ctx.strokeStyle = strike % 2 ? "#c89cff" : "#ffe69a"; ctx.lineWidth = 2.5; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(impactX, impactY, 10 + impact * 50, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1.4;
        for (let shard = 0; shard < 4; shard += 1) {
          const shardAngle = shard * Math.PI / 2 + strike * .37;
          const shardDistance = 12 + impact * (42 + (shard % 2) * 15);
          ctx.beginPath(); ctx.moveTo(impactX + Math.cos(shardAngle) * 8, impactY + Math.sin(shardAngle) * 8); ctx.lineTo(impactX + Math.cos(shardAngle) * shardDistance, impactY + Math.sin(shardAngle) * shardDistance); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = (1 - releaseProgress) * .8;
    if (this.starfallFx.impact) {
      const towerImpactSize = 106 + releaseProgress * 92;
      ctx.drawImage(this.starfallFx.impact, towerX - towerImpactSize / 2, towerY - towerImpactSize / 2, towerImpactSize, towerImpactSize);
    }
    ctx.strokeStyle = "#fff0a8"; ctx.shadowBlur = 0; ctx.lineWidth = 4 - releaseProgress * 1.5;
    ctx.beginPath(); ctx.arc(towerX, towerY, 54 + releaseProgress * 105, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  drawWaveWarning(ctx, state) {
    const wave = state.wave;
    const warningTime = GAME_CONFIG.waves.warning;
    const countdown = wave.nextAt - state.time;
    const warning = wave.warningStarted && countdown > 0 && countdown <= warningTime;
    if (!warning && !wave.active) return;
    const direction = wave.direction;
    const { width, spawnRing } = GAME_CONFIG.arena;
    const pulse = 0.45 + Math.sin(this.time * 8) * 0.2;
    const directionAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    const ingressAngle = directionAngles[direction] ?? directionAngles[0];
    ctx.save();
    ctx.globalAlpha = Math.min(1, pulse + .2);
    ctx.strokeStyle = "rgba(255,70,91,.88)";
    ctx.shadowColor = "#ff304f";
    ctx.shadowBlur = 24;
    ctx.lineWidth = 9;
    ctx.beginPath();
    for (let index = 0; index <= 24; index += 1) {
      const angle = ingressAngle - spawnRing.ingressArc / 2 + spawnRing.ingressArc * index / 24;
      const point = getArenaEdgePosition(angle);
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,184,168,.95)";
    ctx.stroke();
    const marker = getArenaEdgePosition(ingressAngle);
    const markerX = marker.x;
    const markerY = marker.y;
    ctx.translate(markerX, markerY);
    ctx.rotate(ingressAngle + Math.PI / 2);
    ctx.fillStyle = "rgba(255,57,82,.92)";
    ctx.beginPath();
    ctx.moveTo(0, 18); ctx.lineTo(-13, -8); ctx.lineTo(13, -8); ctx.closePath();
    ctx.fill();
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
    const { x: centerX, y: centerY } = getTowerPosition(state);
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
      glow.addColorStop(0, zone.frostfire ? "rgba(220,248,255,.42)" : "rgba(255,214,111,.36)");
      glow.addColorStop(.45, zone.frostfire ? "rgba(255,91,48,.23)" : "rgba(255,92,43,.2)");
      glow.addColorStop(1, zone.frostfire ? "rgba(72,151,255,0)" : "rgba(97,16,32,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, zone.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = zone.frostfire ? "rgba(128,226,255,.86)" : "rgba(255,126,61,.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 9]);
      ctx.rotate(this.time * .8 + zone.id);
      ctx.beginPath(); ctx.arc(0, 0, zone.radius * .72, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      for (let ember = 0; ember < 8; ember += 1) {
        const angle = ember * Math.PI / 4 + this.time * .5;
        const distance = zone.radius * (.22 + (ember % 3) * .18);
        const lift = Math.sin(this.time * 5 + ember) * 5;
        ctx.fillStyle = zone.frostfire ? (ember % 2 ? "#ff6838" : "#8cecff") : ember % 2 ? "#ff6a38" : "#ffd16e";
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
      if (projectile.source?.startsWith("drone")) {
        const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
        const ux = projectile.vx / speed;
        const uy = projectile.vy / speed;
        const angle = Math.atan2(projectile.vy, projectile.vx);
        const role = projectile.droneClass ?? "fighter";
        const color = role === "bomber" ? "#ffad62" : role === "attacker" ? "#ffd96d" : "#72efff";
        ctx.save();
        ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = role === "bomber" ? 20 : 12;
        ctx.lineWidth = role === "bomber" ? 6 : role === "attacker" ? 3.5 : 2;
        ctx.beginPath(); ctx.moveTo(projectile.x - ux * (role === "bomber" ? 24 : 18), projectile.y - uy * (role === "bomber" ? 24 : 18)); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
        ctx.translate(projectile.x, projectile.y); ctx.rotate(angle);
        ctx.fillStyle = role === "bomber" ? "#5b2631" : role === "attacker" ? "#6a421e" : "#dfffff";
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (role === "bomber") ctx.arc(0, 0, 8, 0, Math.PI * 2);
        else { ctx.moveTo(9, 0); ctx.lineTo(-5, -4); ctx.lineTo(-2, 0); ctx.lineTo(-5, 4); ctx.closePath(); }
        ctx.fill(); ctx.stroke(); ctx.restore();
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
      if (projectile.source === "cannonSplit") {
        const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
        const ux = projectile.vx / speed;
        const uy = projectile.vy / speed;
        ctx.save();
        ctx.strokeStyle = "rgba(205,154,255,.45)";
        ctx.shadowColor = "#bd7dff";
        ctx.shadowBlur = 11;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(projectile.x - ux * 15, projectile.y - uy * 15); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
        ctx.translate(projectile.x, projectile.y); ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
        ctx.fillStyle = "#c89cff"; ctx.strokeStyle = "#f3e9ff"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-3, -3.5); ctx.lineTo(-5, 0); ctx.lineTo(-3, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
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
      if (rift.elite) {
        ctx.save(); ctx.rotate(-this.time * 1.8); ctx.strokeStyle = "#ffd45d"; ctx.shadowColor = "#ff5ac8"; ctx.shadowBlur = 20; ctx.lineWidth = 4; ctx.setLineDash([5, 8]);
        ctx.beginPath(); ctx.arc(0, 0, radius + 10 + pulse * 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      }
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
      if ((projectile.kind === "colossusMortar" || projectile.kind === "sovereignMortar") && imageReady(this.assets.bossProjectile)) {
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
      if (effect.element === "sawStorm") {
        const alpha = Math.max(0, effect.life / effect.maxLife);
        const progress = 1 - alpha;
        const radius = effect.radius * (.28 + progress * .72);
        ctx.save(); ctx.translate(effect.x, effect.y); ctx.rotate(this.time * 2.4); ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha * .78; ctx.strokeStyle = "#ffe69a"; ctx.shadowColor = "#ff9d3d"; ctx.shadowBlur = 24; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#fff6cf"; ctx.lineWidth = 2;
        for (let blade = 0; blade < 12; blade += 1) {
          const angle = blade * Math.PI / 6;
          ctx.beginPath(); ctx.moveTo(Math.cos(angle) * radius * .64, Math.sin(angle) * radius * .64); ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.stroke();
        }
        ctx.restore();
        continue;
      }
      if (effect.element === "sawHomecoming") {
        const alpha = Math.max(0, effect.life / effect.maxLife);
        const progress = 1 - alpha;
        const radius = effect.radius * (.18 + progress * .82);
        ctx.save(); ctx.translate(effect.x, effect.y); ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha * .75; ctx.strokeStyle = "#8ff5ff"; ctx.shadowColor = "#7b80ff"; ctx.shadowBlur = 26; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = alpha * .5; ctx.strokeStyle = "#ffe18b"; ctx.lineWidth = 2; ctx.setLineDash([8, 7]);
        ctx.beginPath(); ctx.arc(0, 0, radius * .68, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
        continue;
      }
      if (effect.element === "droneBomb") {
        const alpha = Math.max(0, effect.life / effect.maxLife);
        const progress = 1 - alpha;
        const radius = effect.radius * (.2 + progress * .8);
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.translate(effect.x, effect.y);
        ctx.globalAlpha = alpha * .72; ctx.fillStyle = "rgba(255,116,54,.28)"; ctx.shadowColor = "#ff8b4d"; ctx.shadowBlur = 24;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#ffd478"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, radius * .72, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        continue;
      }
      if (effect.element === "starfallFollowup") {
        const alpha = Math.max(0, effect.life / effect.maxLife);
        const progress = 1 - alpha;
        const radius = effect.radius * (.28 + progress * .72);
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.translate(effect.x, effect.y); ctx.rotate(this.time * 1.8);
        ctx.globalAlpha = alpha * .72; ctx.strokeStyle = "#ffe49a"; ctx.shadowColor = "#a77cff"; ctx.shadowBlur = 22; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#d8c5ff"; ctx.lineWidth = 2;
        for (let point = 0; point < 8; point += 1) {
          const angle = point * Math.PI / 4;
          ctx.beginPath(); ctx.moveTo(Math.cos(angle) * radius * .22, Math.sin(angle) * radius * .22); ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.stroke();
        }
        ctx.globalAlpha = alpha * .42; ctx.fillStyle = "#fff0af"; ctx.beginPath(); ctx.arc(0, 0, Math.max(5, radius * .2), 0, Math.PI * 2); ctx.fill(); ctx.restore();
        continue;
      }
      if (effect.element === "starPiercer") {
        const alpha = Math.max(0, effect.life / effect.maxLife);
        const progress = 1 - alpha;
        const dx = effect.x2 - effect.x1;
        const dy = effect.y2 - effect.y1;
        const length = Math.hypot(dx, dy) || 1;
        const ux = dx / length;
        const uy = dy / length;
        const endX = effect.x2 + ux * 70;
        const endY = effect.y2 + uy * 70;
        const pulse = 1 + Math.sin(this.time * 64) * .12;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        for (const [width, color, opacity, blur] of [[24, "#ff9d38", .18, 30], [13, "#ffd85e", .48, 22], [6, "#fff6bf", .9, 12], [2, "#ffffff", 1, 5]]) {
          ctx.globalAlpha = alpha * opacity;
          ctx.strokeStyle = color;
          ctx.lineWidth = width * pulse;
          ctx.shadowColor = color;
          ctx.shadowBlur = blur;
          ctx.beginPath(); ctx.moveTo(effect.x1, effect.y1); ctx.lineTo(endX, endY); ctx.stroke();
        }
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#fff3a2";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 8]);
        ctx.beginPath(); ctx.arc(effect.x2, effect.y2, 22 + progress * 42, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = alpha * .9;
        ctx.beginPath(); ctx.arc(effect.x1, effect.y1, 7 + alpha * 8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      if (effect.element === "cannonCascade") {
        const alpha = Math.max(0, effect.life / effect.maxLife);
        const progress = 1 - alpha;
        const radius = effect.radius * (.24 + progress * .76);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const gradient = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, Math.max(1, radius));
        gradient.addColorStop(0, `rgba(255,220,255,${.46 * alpha})`);
        gradient.addColorStop(.18, `rgba(255,156,246,${.58 * alpha})`);
        gradient.addColorStop(.55, `rgba(178,75,255,${.34 * alpha})`);
        gradient.addColorStop(1, "rgba(85,20,150,0)");
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2); ctx.fill();
        for (const scale of [1, .68]) {
          ctx.globalAlpha = alpha * (scale === 1 ? .9 : .65);
          ctx.strokeStyle = scale === 1 ? "#ec9cff" : "#efc4ff";
          ctx.lineWidth = scale === 1 ? 5 : 2;
          ctx.shadowColor = "#b64cff";
          ctx.shadowBlur = 22;
          ctx.beginPath(); ctx.arc(effect.x, effect.y, radius * scale, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.strokeStyle = "#f4b0ff";
        ctx.lineWidth = 3;
        for (let index = 0; index < 16; index += 1) {
          const angle = index * Math.PI / 8 + this.time * (index % 2 ? .7 : -.45);
          const inner = radius * (.22 + (index % 3) * .05);
          const outer = radius * (.78 + (index % 4) * .08);
          ctx.globalAlpha = alpha * (.45 + (index % 3) * .15);
          ctx.beginPath();
          ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
          ctx.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
          ctx.stroke();
        }
        ctx.setLineDash([8, 7]);
        for (const target of effect.targets ?? []) {
          ctx.globalAlpha = alpha * .72;
          ctx.beginPath(); ctx.moveTo(effect.x, effect.y); ctx.lineTo(target.x, target.y); ctx.stroke();
        }
        ctx.restore();
        continue;
      }
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
    const towerPosition = getTowerPosition(state);
    const crowdMode = state.enemies.length >= 160;
    for (const anchor of state.enemies.filter((enemy) => enemy.type === "anchor" && enemy.hp > 0 && !enemy.riftAnchor)) {
      const boss = state.enemies.find((enemy) => enemy.id === anchor.anchorBossId && enemy.hp > 0);
      if (!boss) continue;
      const visual = ANCHOR_VISUALS[anchor.anchorRole] ?? ANCHOR_VISUALS.shield;
      ctx.save(); ctx.strokeStyle = visual.color; ctx.globalAlpha = .48; ctx.shadowColor = visual.color; ctx.shadowBlur = 9; ctx.lineWidth = anchor.anchorRole === "overload" ? 2.5 : 1.6; ctx.setLineDash(anchor.anchorRole === "repair" ? [2, 5] : anchor.anchorRole === "summon" ? [9, 6] : [5, 7]);
      ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(boss.x, boss.y); ctx.stroke(); ctx.restore();
    }
    for (const enemy of state.enemies) {
      if (enemy.riftAnchor) continue;
      const crowdVisualScale = getCrowdVisualScale(enemy.unitCount);
      const crowdVisualRadius = enemy.radius * crowdVisualScale;
      const [bright, dark] = ENEMY_COLORS[enemy.type];
      const isBoss = enemy.type === "boss";
      const isColossus = enemy.type === "colossus";
      const isSovereign = enemy.type === "sovereign";
      const isAnchor = enemy.type === "anchor";
      const isWaveType = enemy.type === "crawler" || enemy.type === "sentinel";
      const isAstralType = ASTRAL_ENEMY_TYPES.has(enemy.type);
      const atlas = isAstralType ? this.assets.astralEnemies : isWaveType ? this.assets.waveEnemies : this.assets.enemies;
      const sovereignEntry = isSovereign ? 1 - Math.max(0, enemy.entryTimer ?? 0) / GAME_CONFIG.sovereign.entryDuration : 1;
      const renderY = isSovereign ? enemy.y - (1 - sovereignEntry) * 390 : enemy.y;
      const fastCrowdSprite = crowdMode && !isChapterTwo(state) && !isBoss && !isColossus && !isSovereign && !isAnchor && !enemy.elite && enemy.type !== "hexer" && enemy.type !== "rammer" && imageReady(atlas);
      if (enemy.rangedFlash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, enemy.rangedFlash * 6.25);
        ctx.strokeStyle = "#c795ff";
        ctx.shadowColor = "#8d4dff";
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(towerPosition.x, towerPosition.y); ctx.stroke();
        ctx.restore();
      }
      if (fastCrowdSprite) {
        const cell = atlas.naturalWidth / 2;
        const [column, row] = ENEMY_ATLAS_CELLS[enemy.type];
        const size = enemy.radius * 3.05 * crowdVisualScale;
        ctx.globalAlpha = enemy.hitFlash > 0 ? .68 : 1;
        ctx.drawImage(atlas, column * cell, row * cell, cell, cell, enemy.x - size / 2, renderY - size / 2, size, size);
        ctx.globalAlpha = 1;
      } else {
      ctx.save();
      ctx.translate(enemy.x, renderY);
      const angle = enemy.type === "sovereign" ? 0 : enemy.type === "colossus" ? (enemy.orbitAngle ?? 0) + Math.PI / 2 : Math.atan2(GAME_CONFIG.arena.centerY - enemy.y, GAME_CONFIG.arena.centerX - enemy.x);
      ctx.rotate(angle);
      ctx.scale(crowdVisualScale, crowdVisualScale);
      const resistanceColor = { frost: "#7de8ff", fire: "#ff754d", lightning: "#c6a2ff" }[enemy.resistance];
      ctx.shadowColor = enemy.type === "boss" ? resistanceColor ?? bright : bright;
      ctx.shadowBlur = enemy.type === "sovereign" ? 34 : enemy.type === "colossus" ? 24 : enemy.type === "boss" ? 18 : crowdMode ? 0 : 7;
      if (isAnchor) {
        const visual = ANCHOR_VISUALS[enemy.anchorRole] ?? ANCHOR_VISUALS.shield;
        ctx.rotate(-angle + this.time * 1.7);
        ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : visual.dark; ctx.strokeStyle = visual.color; ctx.lineWidth = 2; ctx.shadowColor = visual.color; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(0, -enemy.radius); ctx.lineTo(enemy.radius * .72, 0); ctx.lineTo(0, enemy.radius); ctx.lineTo(-enemy.radius * .72, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.rotate(-this.time * 1.7); ctx.fillStyle = "#fff"; ctx.font = "900 14px 'Microsoft YaHei UI',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(visual.symbol, 0, 0);
      } else if (isChapterTwo(state) && isSovereign && imageReady(this.assets.chapterTwoSovereign)) {
        const flagship = this.assets.chapterTwoSovereign;
        const width = 360;
        const height = width * (flagship.naturalHeight / flagship.naturalWidth);
        ctx.globalAlpha = Math.min(1, sovereignEntry * 1.35) * (enemy.hitFlash > 0 ? .72 : 1);
        ctx.drawImage(flagship, -width / 2, -height * .38, width, height);
        if (enemy.hitFlash > 0) {
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = Math.min(.68, enemy.hitFlash * 7);
          ctx.drawImage(flagship, -width / 2, -height * .38, width, height);
        }
      } else if (isChapterTwo(state) && !isBoss && !isColossus && imageReady(this.assets.chapterTwoEnemies)) {
        const atlas = this.assets.chapterTwoEnemies;
        const [column, row] = CHAPTER_TWO_ENEMY_CELLS[enemy.type] ?? [0, 0];
        const cellWidth = atlas.naturalWidth / 2;
        const cellHeight = atlas.naturalHeight / 2;
        const width = Math.max(42, enemy.radius * (enemy.type === "runner" || enemy.type === "inkHound" ? 4.8 : 4.45));
        const height = width * (cellHeight / cellWidth);
        ctx.globalAlpha = enemy.hitFlash > 0 ? .7 : 1;
        ctx.drawImage(atlas, column * cellWidth, row * cellHeight, cellWidth, cellHeight, -width / 2, -height / 2, width, height);
        if (enemy.hitFlash > 0) {
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = Math.min(.62, enemy.hitFlash * 7);
          ctx.drawImage(atlas, column * cellWidth, row * cellHeight, cellWidth, cellHeight, -width / 2, -height / 2, width, height);
        }
      } else if (isChapterTwo(state)) {
        const large = isSovereign || isColossus || isBoss;
        const length = isSovereign ? 410 : isColossus ? 190 : isBoss ? 132 : enemy.radius * 3.8;
        const beam = isSovereign ? 92 : isColossus ? 62 : isBoss ? 48 : Math.max(16, enemy.radius * 1.35);
        const hull = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
        hull.addColorStop(0, enemy.hitFlash > 0 ? "#ffffff" : "#102b3b"); hull.addColorStop(.55, large ? "#31536a" : dark); hull.addColorStop(1, "#07141d");
        ctx.fillStyle = hull; ctx.strokeStyle = large ? "#ff8371" : bright; ctx.lineWidth = large ? 3 : 1.6;
        ctx.beginPath(); ctx.moveTo(length * .52, 0); ctx.lineTo(length * .28, -beam * .48); ctx.lineTo(-length * .38, -beam * .42); ctx.lineTo(-length * .52, 0); ctx.lineTo(-length * .34, beam * .42); ctx.lineTo(length * .3, beam * .46); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = large ? "#ff735f" : "#8cecff"; ctx.globalAlpha = .9;
        ctx.fillRect(-length * .12, -beam * .34, length * .36, beam * .16);
        ctx.fillStyle = "#d8fbff"; ctx.fillRect(length * .03, -beam * .2, length * .1, beam * .4);
        if (enemy.type === "orbitMote") { ctx.globalAlpha = .48; ctx.strokeStyle = "#75dfff"; ctx.beginPath(); ctx.arc(0, 0, length * .62, 0, Math.PI * 2); ctx.stroke(); }
        if (isSovereign) { ctx.fillStyle = "#ffb36d"; for (const offset of [-.3, -.08, .16, .36]) ctx.fillRect(length * offset, -beam * .58, 24, 9); }
      } else if (isSovereign && imageReady(this.assets.sovereign)) {
        const width = 760;
        const height = width * (this.assets.sovereign.naturalHeight / this.assets.sovereign.naturalWidth);
        ctx.globalAlpha = Math.min(1, sovereignEntry * 1.35) * (enemy.hitFlash > 0 ? 0.76 : 1);
        ctx.drawImage(this.assets.sovereign, -width / 2, -height * .42, width, height);
        if (enemy.hitFlash > 0) {
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = Math.min(0.72, enemy.hitFlash * 7);
          ctx.drawImage(this.assets.sovereign, -width / 2, -height * .42, width, height);
        }
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
        const [column, row] = ENEMY_ATLAS_CELLS[enemy.type];
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
        ctx.lineWidth = isBoss || isColossus || isSovereign ? 3 : 1.5;
        ctx.beginPath();
        if (enemy.type === "runner") {
          ctx.moveTo(enemy.radius, 0); ctx.lineTo(-enemy.radius, -enemy.radius * .72); ctx.lineTo(-enemy.radius * .55, 0); ctx.lineTo(-enemy.radius, enemy.radius * .72);
        } else {
          const points = isBoss || isColossus || isSovereign ? 12 : enemy.type === "brute" ? 8 : 0;
          if (points) for (let i = 0; i < points; i += 1) { const a = i * Math.PI * 2 / points; const r = i % 2 ? enemy.radius * .75 : enemy.radius; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
          else { ctx.moveTo(enemy.radius, 0); ctx.quadraticCurveTo(0, -enemy.radius * 1.1, -enemy.radius, 0); ctx.quadraticCurveTo(0, enemy.radius * 1.1, enemy.radius, 0); }
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = bright;
        ctx.beginPath(); ctx.arc(enemy.radius * .18, 0, Math.max(2.5, enemy.radius * .18), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      }

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
      if (enemy.type === "sovereign") {
        const announcedSkill = enemy.intentSkill ?? enemy.activeSkill;
        const skillVisual = COLOSSUS_SKILLS[announcedSkill];
        const pulse = .5 + Math.sin(this.time * (enemy.enraged ? 11 : 6)) * .5;
        ctx.save();
        ctx.strokeStyle = enemy.enraged ? "#ff3d31" : skillVisual?.color ?? "#d65cff";
        ctx.fillStyle = enemy.enraged ? "rgba(255,34,28,.12)" : "rgba(166,62,255,.08)";
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 28 + pulse * 20; ctx.lineWidth = enemy.enraged ? 5 : 3;
        ctx.setLineDash(enemy.intentSkill ? [18, 8] : [7, 14]);
        ctx.beginPath(); ctx.ellipse(enemy.x, enemy.y + 38, 340 + pulse * 18, 142 + pulse * 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (enemy.intentSkill === "beam" || enemy.intentSkill === "artillery") {
            ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y + 60); ctx.lineTo(towerPosition.x, towerPosition.y); ctx.stroke();
        }
        ctx.setLineDash([]); ctx.textAlign = "center"; ctx.font = "900 13px 'Microsoft YaHei UI',sans-serif"; ctx.fillStyle = enemy.enraged ? "#ff6a4d" : skillVisual?.color ?? "#e8b8ff";
        const label = enemy.entryTimer > 0 ? "灾厄显现" : enemy.intentSkill ? `灭世预兆 · ${skillVisual?.name ?? "未知"} ${Math.max(0, enemy.intentTimer).toFixed(1)}s` : skillVisual?.name ?? "裂隙凝视";
        ctx.fillText(label, enemy.x, 287);
        if ((enemy.spawnShield ?? 0) > 0) {
          const shieldRatio = enemy.spawnShield / Math.max(1, enemy.spawnShieldMax);
          ctx.save(); ctx.translate(enemy.x, enemy.y + 30); ctx.rotate(this.time * .42);
          ctx.globalAlpha = .44 + shieldRatio * .42; ctx.fillStyle = "rgba(84,205,255,.08)"; ctx.strokeStyle = "#87efff"; ctx.shadowColor = "#5e7dff"; ctx.shadowBlur = 30 + pulse * 16; ctx.lineWidth = 4;
          ctx.setLineDash([22, 9]); ctx.beginPath(); ctx.ellipse(0, 0, 365, 158, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.rotate(-this.time * .84); ctx.strokeStyle = "#efe2ff"; ctx.lineWidth = 1.8; ctx.setLineDash([5, 13]); ctx.beginPath(); ctx.ellipse(0, 0, 348, 146, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
          ctx.fillStyle = "#a9f6ff"; ctx.fillText(`降临护盾 ${Math.ceil(shieldRatio * 100)}%`, enemy.x, 306);
        } else if (enemy.enraged) { ctx.fillStyle = "#ff4e39"; ctx.fillText("终末狂暴 · 元素效果无效", enemy.x, 306); }
        else if (enemy.healthBar <= 2) { ctx.fillStyle = "#ffd45d"; ctx.fillText("裂隙增殖 · 词缀精英加入", enemy.x, 306); }
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
            ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(towerPosition.x, towerPosition.y); ctx.stroke();
            ctx.beginPath(); ctx.arc(towerPosition.x, towerPosition.y, 42 + pulse * 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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
        const countText = `怪群 ×${enemy.unitCount}`;
        const fontSize = Math.min(15, 10 + Math.log2(enemy.unitCount));
        const labelY = enemy.y - crowdVisualRadius - 25;
        ctx.textAlign = "center";
        ctx.font = `900 ${fontSize}px ui-monospace, monospace`;
        const badgeWidth = ctx.measureText(countText).width + 18;
        ctx.fillStyle = "rgba(39,10,29,.88)";
        ctx.strokeStyle = "rgba(255,216,111,.86)";
        ctx.lineWidth = 1.4;
        ctx.shadowColor = "#ff7b38";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(enemy.x - badgeWidth / 2, labelY - fontSize - 2, badgeWidth, fontSize + 9, 7);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffe49a";
        ctx.shadowColor = "#8c3d18";
        ctx.shadowBlur = 6;
        ctx.fillText(countText, enemy.x, labelY + 1);
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
      if ((enemy.starMarkTimer ?? 0) > 0) {
        const radius = enemy.radius + 20 + Math.sin(this.time * 8 + enemy.id) * 2;
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(this.time * .9); ctx.strokeStyle = "#ffe69b"; ctx.shadowColor = "#b899ff"; ctx.shadowBlur = 14; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let point = 0; point < 8; point += 1) {
          const angle = point * Math.PI / 4;
          const pointRadius = point % 2 ? radius * .55 : radius;
          point ? ctx.lineTo(Math.cos(angle) * pointRadius, Math.sin(angle) * pointRadius) : ctx.moveTo(Math.cos(angle) * pointRadius, Math.sin(angle) * pointRadius);
        }
        ctx.closePath(); ctx.stroke(); ctx.restore();
      }
      if ((enemy.sawScarStacks ?? 0) > 0) {
        const stacks = enemy.sawScarStacks;
        const radius = crowdVisualRadius + 14 + stacks * 1.5;
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(-this.time * (1.1 + stacks * .08));
        ctx.strokeStyle = stacks >= GAME_CONFIG.upgrades.sawOverdrive.scarMaxStacks ? "#fff3ad" : "#ffbc61";
        ctx.shadowColor = "#ff6c35"; ctx.shadowBlur = 8 + stacks * 2; ctx.lineWidth = 1.4 + stacks * .18;
        for (let arc = 0; arc < stacks; arc += 1) {
          const start = arc * Math.PI * 2 / stacks;
          ctx.beginPath(); ctx.arc(0, 0, radius, start, start + Math.min(.72, Math.PI * 1.35 / stacks)); ctx.stroke();
        }
        ctx.rotate(this.time * (1.1 + stacks * .08));
        ctx.fillStyle = "#ffe4a1"; ctx.font = "900 9px 'Microsoft YaHei UI',sans-serif"; ctx.textAlign = "center";
        ctx.fillText(`晶痕 ×${stacks}`, 0, -radius - 7); ctx.restore();
      }
      if (enemy.markTimer > 0) {
        const pulse = 1 + Math.sin(this.time * 7 + enemy.id) * .08;
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.scale(pulse, pulse); ctx.strokeStyle = "#ff71d0"; ctx.shadowColor = "#ff3aae"; ctx.shadowBlur = 13; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let point = 0; point < 6; point += 1) { const a = point * Math.PI / 3; const r = enemy.radius + 24; point ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = "#ffd1ef"; ctx.font = "800 9px 'Microsoft YaHei UI',sans-serif"; ctx.textAlign = "center"; ctx.fillText("猎杀标记", 0, -enemy.radius - 30); ctx.restore();
      }

      if ((enemy.weakpointTimer ?? 0) > 0) {
        const pulse = 1 + Math.sin(this.time * 10 + enemy.id) * .08;
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.scale(pulse, pulse); ctx.rotate(this.time * .9);
        ctx.strokeStyle = "#fff0a8"; ctx.shadowColor = "#ffbd4a"; ctx.shadowBlur = 16; ctx.lineWidth = 2.4; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 18, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#fff4ba"; ctx.font = "800 9px 'Microsoft YaHei UI',sans-serif"; ctx.textAlign = "center"; ctx.rotate(-this.time * .9); ctx.fillText(`弱点 ${enemy.weakpointTimer.toFixed(1)}s`, 0, -enemy.radius - 28); ctx.restore();
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
      if (hpRatio < 0.999 || isBoss || isColossus || isSovereign || enemy.elite) {
        const width = isSovereign ? 260 : isColossus ? 150 : isBoss ? 92 : enemy.elite ? Math.max(48, enemy.radius * 2.5) : crowdVisualRadius * 2;
        const barY = isSovereign ? enemy.y + 108 : enemy.y - crowdVisualRadius - 12;
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(enemy.x - width / 2, barY, width, 4);
        ctx.fillStyle = isSovereign ? "#ff3f70" : isColossus ? "#ff5477" : isBoss ? "#ffc66d" : enemy.elite ? "#ffd35f" : "#ff7076"; ctx.fillRect(enemy.x - width / 2, barY, width * hpRatio, 4);
      }
    }
  }

  drawSaws(ctx, state) {
    const count = state.tower.upgrades.saw;
    if (!count) return;
    const { x: centerX, y: centerY } = getTowerPosition(state);
    const launchedIndexes = new Set(state.launchedSaws.map((saw) => saw.bladeIndex));
    const overdrive = state.tower.upgrades.sawOverdrive;
    const accelerator = state.tower.upgrades.sawAccelerator ?? 0;
    const bladeScale = getSawBladeRadius(state) / GAME_CONFIG.upgrades.saw.bladeRadius;
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
      const radius = getSawOrbitRadius(state, index);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      drawSaw(x, y, -this.time * (8 + overdrive * 2) * (accelerator > 0 ? 1.55 : 1), bladeScale);
    }
    for (const saw of state.launchedSaws) {
      ctx.save();
      ctx.strokeStyle = saw.returning ? "rgba(116,242,255,.78)" : "rgba(255,211,108,.38)";
      ctx.shadowColor = saw.returning ? "#7d7cff" : "#ffc96b"; ctx.shadowBlur = saw.returning ? 14 : 5; ctx.lineWidth = saw.returning ? 3.5 : 2;
      ctx.beginPath(); ctx.moveTo(saw.x - saw.vx * .045, saw.y - saw.vy * .045); ctx.lineTo(saw.x, saw.y); ctx.stroke();
      if (saw.returning) {
        ctx.globalAlpha = .32; ctx.setLineDash([5, 8]); ctx.beginPath(); ctx.moveTo(saw.x, saw.y); ctx.lineTo(centerX, centerY); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();
      // 弹射与环绕共用巨刃铸型的尺寸倍率，避免升级后碰撞半径与画面尺寸不一致。
      drawSaw(saw.x, saw.y, this.time * (saw.returning ? -23 : 18), bladeScale * (saw.returning ? 1.2 : 1.08));
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
      const travelAngle = enemyTarget ? Math.atan2(enemyTarget.y - y, enemyTarget.x - x) : target ? Math.atan2(target.renderY - y, target.renderX - x) : angle + Math.PI / 2;
      ctx.translate(x, y); ctx.rotate(travelAngle);
      const droneClass = drone?.droneClass ?? "fighter";
      const classColor = droneClass === "bomber" ? "#ff8e70" : droneClass === "attacker" ? "#ffd066" : "#6feaff";
      const primaryColor = recovering ? "#6c718c" : detonate ? "#ff715f" : defending ? "#a88cff" : isChapterTwo(state) ? classColor : attacking ? "#ffad4d" : "#7ceeff";
      ctx.shadowColor = primaryColor; ctx.shadowBlur = recovering ? 5 : attacking || defending ? 15 : 10;
      if (isChapterTwo(state) && imageReady(this.assets.chapterTwoDrones)) {
        const atlas = this.assets.chapterTwoDrones;
        const cellWidth = atlas.naturalWidth / 2;
        const cellHeight = atlas.naturalHeight / 2;
        const lowEnergyOverdrive = state.tower.upgrades.droneOverdrive > 0 && state.tower.droneEnergy / getDroneEnergyMax(state) <= .35;
        const column = attacking ? 1 : 0;
        const row = detonate || lowEnergyOverdrive || defending ? 1 : 0;
        ctx.globalAlpha = recovering ? .42 : 1;
        const classScale = droneClass === "bomber" ? 1.16 : droneClass === "attacker" ? 1.04 : .92;
        ctx.drawImage(atlas, column * cellWidth, row * cellHeight, cellWidth, cellHeight, -22 * classScale, -22 * classScale, 44 * classScale, 44 * classScale);
      } else {
        ctx.fillStyle = recovering ? "#20253d" : detonate ? "#4a2630" : defending ? "#302653" : attacking ? "#4a2630" : "#202949";
        ctx.strokeStyle = recovering ? "#747995" : detonate ? "#ffd171" : defending ? "#d2c4ff" : attacking ? "#ffd171" : "#b9f7ff"; ctx.lineWidth = attacking || defending ? 1.7 : 1.2;
        ctx.beginPath();
        if (recovering) ctx.arc(0, 0, 8, 0, Math.PI * 2);
        else if (attacking || defending) {
          ctx.moveTo(0, -15); ctx.lineTo(8, 2); ctx.lineTo(3, 0); ctx.lineTo(0, 8); ctx.lineTo(-3, 0); ctx.lineTo(-8, 2);
        } else {
          ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 7); ctx.lineTo(-8, 0);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = recovering ? "#8e94b7" : detonate ? "#fff0a7" : defending ? "#d9ccff" : attacking ? "#fff0a7" : "#ffc96b"; ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (isChapterTwo(state)) {
        const label = droneClass === "bomber" ? "轰" : droneClass === "attacker" ? "攻" : "截";
        const phase = drone?.phase ?? "docked";
        const ammo = Math.max(0, drone?.ammo ?? 0);
        const ammoMax = getChapterTwoDroneAmmoMax(state, droneClass);
        ctx.save();
        ctx.fillStyle = "rgba(4,7,20,.82)"; ctx.strokeStyle = classColor; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x - 13, y - 13, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#f4fbff"; ctx.font = "800 8px Microsoft YaHei UI,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, x - 13, y - 13.5);
        ctx.fillStyle = "rgba(4,7,20,.94)"; ctx.strokeStyle = ammo > 0 ? classColor : "rgba(130,140,170,.72)";
        ctx.beginPath(); ctx.roundRect(x + 2, y - 27, 43, 18, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ammo > 0 ? "#f4fbff" : "#8f98b5"; ctx.font = "800 9px Microsoft YaHei UI,sans-serif";
        ctx.fillText(`弹 ${ammo}/${ammoMax}`, x + 23.5, y - 18);
        if (["refit", "docked", "recovery"].includes(phase)) {
          ctx.fillStyle = "rgba(5,9,24,.78)"; ctx.font = "700 8px Microsoft YaHei UI,sans-serif"; ctx.fillText(phase === "refit" ? "补给" : phase === "recovery" ? "重组" : "待命", x, y + 25);
        }
        ctx.restore();
      }
      const energyRatio = Math.max(0, Math.min(1, state.tower.droneEnergy / getDroneEnergyMax(state)));
      ctx.save(); ctx.fillStyle = "rgba(4,7,20,.72)"; ctx.fillRect(x - 12, y + 13, 24, 3); ctx.fillStyle = energyRatio < .2 ? "#ff705d" : detonate ? "#ffbd61" : defending ? "#c4a7ff" : attacking ? "#ffbd61" : "#74e7ff"; ctx.fillRect(x - 12, y + 13, 24 * energyRatio, 3); ctx.restore();
      if (recovering) {
        const recoveryRatio = Math.max(0, Math.min(1, drone.recoveryTimer / getDroneDetonateRecovery(state)));
        ctx.save(); ctx.strokeStyle = "rgba(255,210,143,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - recoveryRatio)); ctx.stroke(); ctx.restore();
      }
    }
  }

  drawTowerAim(ctx, state, visual, tier) {
    if (isChapterTwo(state)) return;
    const target = this.towerAimTarget;
    if (!target) return;
    const towerPosition = getTowerPosition(state);
    const dx = target.x - towerPosition.x;
    const dy = target.y - towerPosition.y;
    const angle = this.towerAimAngle;
    const routeColor = visual.cannonRoute === "siege" ? "#ffd27a" : visual.cannonRoute === "split" ? "#d9b4ff" : "#79dff5";
    const pulse = this.towerFx.shoot > 0 ? this.towerFx.shoot / .28 : 0;
    const recoil = pulse * 9;

    const cannon = this.assets.towerMainCannonTiers;
    if (imageReady(cannon)) {
      const cellWidth = cannon.naturalWidth / 2;
      const cellHeight = cannon.naturalHeight / 2;
      const column = tier % 2;
      const row = Math.floor(tier / 2);
      const width = [118, 142, 158, 184][tier];
      const height = width * (cellHeight / cellWidth);
      ctx.save();
      ctx.rotate(angle);
      ctx.translate(-recoil, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = .94 + pulse * .06;
      ctx.shadowColor = routeColor;
      ctx.shadowBlur = 5 + pulse * 6;
      ctx.drawImage(cannon, column * cellWidth, row * cellHeight, cellWidth, cellHeight, -width * .27, -height / 2, width, height);
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = .14 + pulse * .26;
    ctx.strokeStyle = routeColor;
    ctx.shadowColor = routeColor;
    ctx.shadowBlur = 9 + pulse * 10;
    ctx.lineWidth = 1.4 + pulse * 2.2;
    ctx.setLineDash([8, 10]);
    ctx.lineDashOffset = -this.time * 26;
    const muzzleDistance = [44, 60, 72, 94][tier];
    ctx.beginPath(); ctx.moveTo(Math.cos(angle) * muzzleDistance, Math.sin(angle) * muzzleDistance); ctx.lineTo(dx, dy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(this.time * 1.8);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = .54 + pulse * .3;
    ctx.strokeStyle = target.elite || target.type === "boss" || target.type === "sovereign" || target.type === "colossus" ? "#ffd27a" : routeColor;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 10 + pulse * 10;
    ctx.lineWidth = 1.8 + pulse * 1.8;
    const reticleRadius = Math.max(12, target.radius + 8 + Math.sin(this.time * 7) * 2);
    ctx.beginPath(); ctx.arc(0, 0, reticleRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-reticleRadius - 7, 0); ctx.lineTo(-reticleRadius + 1, 0);
    ctx.moveTo(reticleRadius - 1, 0); ctx.lineTo(reticleRadius + 7, 0);
    ctx.moveTo(0, -reticleRadius - 7); ctx.lineTo(0, -reticleRadius + 1);
    ctx.moveTo(0, reticleRadius - 1); ctx.lineTo(0, reticleRadius + 7);
    ctx.stroke();
    ctx.restore();
  }
  drawTowerRouteModules(ctx, state, visual, tier) {
    const route = visual.cannonRoute;
    const asset = route === "siege" ? this.assets.towerRouteSiege : route === "split" ? this.assets.towerRouteSplit : null;
    if (route === "none") return;
    if (imageReady(asset)) {
      const width = route === "siege" ? 184 + tier * 14 : 170 + tier * 12;
      const height = width * (asset.naturalHeight / Math.max(1, asset.naturalWidth));
      ctx.save();
      ctx.globalAlpha = visual.damageBand === "collapse" ? .45 : .92;
      const modulePulse = 1 + Math.sin(this.time * 3.2 + tier) * .018 + (this.towerFx.shoot > 0 ? this.towerFx.shoot / .28 * .045 : 0);
      ctx.translate(0, Math.sin(this.time * 2.1) * .8);
      ctx.rotate(route === "split" ? this.time * .24 : Math.sin(this.time * 1.35) * .035);
      ctx.scale(modulePulse, modulePulse);
      ctx.shadowColor = route === "siege" ? "#ffd27a" : "#d2a7ff";
      ctx.shadowBlur = 10 + tier * 3;
      ctx.drawImage(asset.cutout ?? asset, -width / 2, -height / 2, width, height);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.globalAlpha = .72;
    ctx.strokeStyle = route === "siege" ? "#ffd27a" : "#d2a7ff";
    ctx.fillStyle = route === "siege" ? "rgba(255,210,122,.22)" : "rgba(210,167,255,.22)";
    ctx.lineWidth = 2.2;
    if (route === "siege") {
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(side * 28, -8); ctx.lineTo(side * 98, -27); ctx.lineTo(side * 111, 0); ctx.lineTo(side * 72, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else {
      for (let petal = 0; petal < 6; petal += 1) {
        const angle = petal * Math.PI / 3 - Math.PI / 2;
        const inner = 54 + tier * 7; const outer = 96 + tier * 11;
        ctx.beginPath(); ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner); ctx.lineTo(Math.cos(angle - .18) * outer, Math.sin(angle - .18) * outer); ctx.lineTo(Math.cos(angle + .18) * outer, Math.sin(angle + .18) * outer); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawTowerSkillMechanics(ctx, state, visual, tier) {
    const heatRatio = Math.max(0, Math.min(1.25, Number(state.skills.overload.heat ?? 0) / Math.max(1, GAME_CONFIG.skills.overload.overheatThreshold)));
    if (visual.overloadBand !== "off") {
      const shell = this.assets.towerShellPanels;
      const openness = Math.min(1, .24 + heatRatio * .78);
      const pulse = .5 + Math.sin(this.time * (6 + heatRatio * 4)) * .5;
      if (imageReady(shell)) {
        const width = 145 + tier * 14 + openness * 20;
        const height = width * (shell.naturalHeight / Math.max(1, shell.naturalWidth));
        ctx.save();
        ctx.globalAlpha = .36 + openness * .42 + pulse * .08;
        ctx.translate(0, openness * 3);
        ctx.scale(1 + openness * .13, 1 + openness * .08);
        ctx.shadowColor = visual.overloadBand === "overheated" ? "#ff704d" : "#c99cff";
        ctx.shadowBlur = 13 + heatRatio * 9;
        ctx.drawImage(shell.cutout ?? shell, -width / 2, -height / 2, width, height);
        ctx.restore();
      }
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = .42 + heatRatio * .25;
      ctx.strokeStyle = visual.overloadBand === "overheated" ? "#ff704d" : "#d7b5ff";
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8 + heatRatio * 5;
      ctx.lineWidth = 2 + heatRatio * 1.6;
      ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.arc(0, 0, 58 + tier * 10 + openness * 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, heatRatio)); ctx.stroke();
      ctx.restore();
    }

    if (visual.starfallBand !== "off") {
      const angle = Number(state.skills.starfall.aimAngle ?? state.skills.starfall.angle ?? 0);
      const active = visual.starfallBand === "release";
      ctx.save();
      ctx.rotate(angle);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = active ? .82 : .62;
      ctx.strokeStyle = active ? "#fff2b8" : "#d8c7ff";
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = active ? 18 : 9; ctx.lineWidth = active ? 4 : 2.5;
      ctx.beginPath(); ctx.moveTo(0, -26 - tier * 8); ctx.lineTo(0, -104 - tier * 18); ctx.stroke();
      ctx.lineWidth = 1.4;
      for (const spread of [-.14, .14]) { ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(Math.sin(spread) * (84 + tier * 14), -Math.cos(spread) * (84 + tier * 14)); ctx.stroke(); }
      ctx.restore();
    }

    if (visual.shieldBand === "armed") {
      const armedPulse = .72 + Math.sin(this.time * 5.5) * .18;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = armedPulse;
      ctx.strokeStyle = "#c8fbff"; ctx.shadowColor = "#72e8ff"; ctx.shadowBlur = 12; ctx.lineWidth = 3;
      for (let plate = 0; plate < 6; plate += 1) {
        const angle = plate * Math.PI / 3 + this.time * .15; const radius = 62 + tier * 9;
        ctx.save(); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(-12, -radius); ctx.lineTo(0, -radius - 10); ctx.lineTo(12, -radius); ctx.lineTo(8, -radius + 13); ctx.lineTo(-8, -radius + 13); ctx.closePath(); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
    }

    if (this.towerFx.heal > 0) {
      const progress = 1 - this.towerFx.heal / 1.1;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - progress) * .68; ctx.strokeStyle = "#9fffd0"; ctx.shadowColor = "#79ffad"; ctx.shadowBlur = 12; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 42 + progress * 74, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke(); ctx.restore();
    }
  }

  drawTowerDamage(ctx, state, visual, tier) {
    if (visual.damageBand === "intact") return;
    const intensity = visual.damageBand === "damaged" ? .48 : visual.damageBand === "critical" ? .78 : 1;
    const crackColor = visual.damageBand === "collapse" ? "#ff6b78" : "#ff9aa5";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = intensity * (.72 + Math.sin(this.time * 8) * .16);
    ctx.strokeStyle = crackColor; ctx.shadowColor = crackColor; ctx.shadowBlur = 8 + intensity * 5; ctx.lineWidth = 1.8 + intensity;
    const cracks = visual.damageBand === "damaged" ? [[-10, -28, 2, -9, -8, 9]] : [[-18, -40, -2, -16, -11, 4, 5, 26], [18, -31, 6, -9, 17, 8], [-30, 8, -8, 13, -18, 35]];
    for (const points of cracks) { ctx.beginPath(); ctx.moveTo(points[0], points[1]); for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]); ctx.stroke(); }
    if (visual.damageBand !== "damaged") {
      ctx.globalAlpha = intensity * .62;
      ctx.fillStyle = "#a9efff";
      for (let shard = 0; shard < (visual.damageBand === "collapse" ? 5 : 2); shard += 1) {
        const angle = -1.4 + shard * .72 + Math.sin(this.time * 2 + shard) * .04;
        const radius = 54 + tier * 8 + shard * 7;
        ctx.save(); ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.rotate(angle + Math.PI / 2 + this.time * .7); ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-3, 8); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    if (visual.damageBand === "collapse") {
      ctx.globalAlpha = .42 + Math.sin(this.time * 10) * .12;
      ctx.fillStyle = "#ff526f"; ctx.beginPath(); ctx.arc(0, -6, 12 + Math.sin(this.time * 7) * 2, 0, Math.PI * 2); ctx.fill();
    }
    if (this.towerFx.hit > 0) {
      ctx.globalAlpha = Math.min(.55, this.towerFx.hit * 1.8);
      ctx.strokeStyle = "#fff0f0"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 48 + tier * 8, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  drawTower(ctx, state) {
    const { x, y } = getTowerPosition(state);
    const towerScale = state.enemies.some((enemy) => enemy.type === "sovereign" && enemy.hp > 0) ? GAME_CONFIG.sovereign.towerScale : 1;
    const towerArtScale = TOWER_ART_SCALE;
    const visual = getTowerVisualState(state);
    const tier = visual.tier;
    const stats = getTowerStats(state);
    const hpRatio = visual.hpRatio;
    const overload = state.skills.overload.active > 0 || state.skills.overload.permanentEngaged;
    const heatRatio = Math.max(0, Math.min(1.25, state.skills.overload.heat / GAME_CONFIG.skills.overload.overheatThreshold));

    ctx.save(); ctx.translate(x, y); ctx.scale(towerScale * towerArtScale, towerScale * towerArtScale);
    ctx.globalAlpha = 0.18 + hpRatio * 0.12;
    ctx.fillStyle = overload ? (heatRatio >= 1 ? "#ff704d" : "#c99cff") : state.skills.overload.slow > 0 ? "#b9474f" : "#7ceeff";
    ctx.beginPath(); ctx.arc(0, 0, 55 + tier * 13 + Math.sin(this.time * 2.5) * 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    const crystalShieldRatio = state.tower.shield > 0
      ? Math.min(1, state.tower.shield / (stats.maxHp * GAME_CONFIG.skills.heal.shieldCapFraction))
      : 0;
    if (crystalShieldRatio > 0) {
      this.drawTowerCrystalShield(ctx, tier, crystalShieldRatio, state.skills.heal.shieldBurstArmed, false);
    }

    if (state.tower.droneGuardShield > 0) {
      const guardRatio = Math.min(1, state.tower.droneGuardShield / getDroneGuardShieldMax(state));
      ctx.save(); ctx.rotate(this.time * .55); ctx.globalAlpha = .24 + guardRatio * .42; ctx.strokeStyle = "#bfadff"; ctx.shadowColor = "#a789ff"; ctx.shadowBlur = 18; ctx.lineWidth = 3;
      ctx.setLineDash([5, 8]); ctx.beginPath(); ctx.arc(0, 0, 72 + tier * 10, .2, .2 + Math.PI * 2 * guardRatio); ctx.stroke(); ctx.restore();
    }
    if (state.tower.upgrades.droneIntercept > 0 && state.tower.interceptCharge > 0 && state.tower.droneMode === "collect") {
      ctx.save(); ctx.rotate(this.time * .35); ctx.strokeStyle = "rgba(168,248,255,.78)"; ctx.shadowColor = "#69e4ff"; ctx.shadowBlur = 13; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let point = 0; point < 6; point += 1) { const a = point * Math.PI / 3; const r = 75 + tier * 10; point ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.stroke(); ctx.restore();
    }

    if (overload) {
      const overloadHeatArc = Math.min(1, heatRatio);
      const overloadPulse = .5 + Math.sin(this.time * (7 + heatRatio * 4)) * .5;
      const overloadEnergyColor = heatRatio >= 1 ? "#ff704d" : heatRatio >= .72 ? "#ff9a67" : "#c99cff";
      const overloadHighlight = heatRatio >= 1 ? "#ffe0a8" : "#f2dcff";
      const orbitRadius = 64 + tier * 11 + overloadPulse * 3;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.rotate(this.time * (1.05 + heatRatio * .65));
      ctx.globalAlpha = .34 + heatRatio * .25;
      ctx.strokeStyle = overloadEnergyColor; ctx.shadowColor = overloadEnergyColor; ctx.shadowBlur = 6 + heatRatio * 3; ctx.lineWidth = 2.2 + heatRatio;
      ctx.setLineDash([10, 7, 3, 8]);
      ctx.beginPath(); ctx.arc(0, 0, orbitRadius, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      // 环绕碎片按颜色合并路径，保留动态轨道但减少上下文切换。
      const drawOrbitShards = (highlight) => {
        ctx.globalAlpha = .35 + overloadPulse * .35;
        ctx.strokeStyle = highlight ? overloadHighlight : overloadEnergyColor;
        ctx.lineWidth = highlight ? 2.2 : 1.4;
        ctx.beginPath();
        for (let shard = highlight ? 0 : 1; shard < 8; shard += 2) {
          const angle = shard * Math.PI / 4;
          const radius = orbitRadius + Math.sin(this.time * 5 + shard * 1.7) * 5;
          const shardLength = 5 + heatRatio * 5 + (shard % 2) * 3;
          const radialX = Math.cos(angle);
          const radialY = Math.sin(angle);
          const tangentX = -radialY;
          const tangentY = radialX;
          const movePoint = (localX, localY, move = false) => {
            const pointX = radialX * (radius + localX) + tangentX * localY;
            const pointY = radialY * (radius + localX) + tangentY * localY;
            if (move) ctx.moveTo(pointX, pointY);
            else ctx.lineTo(pointX, pointY);
          };
          movePoint(-shardLength, -3, true); movePoint(0, 1); movePoint(shardLength, -2);
        }
        ctx.stroke();
      };
      drawOrbitShards(true);
      drawOrbitShards(false);
      ctx.restore();

      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.rotate(-this.time * .28);
      ctx.globalAlpha = .48 + overloadPulse * .2;
      ctx.strokeStyle = overloadHighlight; ctx.shadowColor = overloadEnergyColor; ctx.shadowBlur = 0; ctx.lineWidth = 3.2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.arc(0, 0, orbitRadius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * overloadHeatArc); ctx.stroke();
      ctx.restore();
    }

    for (let ring = 0; ring <= tier; ring += 1) {
      ctx.save(); ctx.rotate(this.time * (ring % 2 ? -0.45 : 0.35) + ring);
      ctx.strokeStyle = ring === 2 ? "rgba(255,207,114,.68)" : "rgba(124,238,255,.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 10 + ring * 3]);
      ctx.beginPath(); ctx.arc(0, 0, 49 + ring * 13, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (isChapterTwo(state)) {
      const deckLength = 166 + tier * 18;
      if (imageReady(this.assets.chapterTwoCarrier)) {
        const carrier = this.assets.chapterTwoCarrier;
        const deckHeight = deckLength * (carrier.naturalHeight / carrier.naturalWidth);
        ctx.shadowColor = overload ? "#d89cff" : "#5de4ff";
        ctx.shadowBlur = 18 + tier * 4;
        ctx.drawImage(carrier, -deckLength / 2, -deckHeight / 2, deckLength, deckHeight);
      } else {
        const deckWidth = 58 + tier * 8;
        const hull = ctx.createLinearGradient(-deckLength / 2, 0, deckLength / 2, 0);
        hull.addColorStop(0, "#071722"); hull.addColorStop(.5, overload ? "#58447d" : "#244e64"); hull.addColorStop(1, "#081821");
        ctx.fillStyle = hull; ctx.strokeStyle = overload ? "#e2b0ff" : "#78e9ff"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(deckLength * .54, 0); ctx.lineTo(deckLength * .32, -deckWidth * .48); ctx.lineTo(-deckLength * .38, -deckWidth * .42); ctx.lineTo(-deckLength * .54, 0); ctx.lineTo(-deckLength * .36, deckWidth * .44); ctx.lineTo(deckLength * .34, deckWidth * .48); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(137,242,255,.28)"; ctx.fillRect(-deckLength * .34, -4, deckLength * .68, 8);
      }
      ctx.save(); ctx.rotate(this.time * .5); ctx.strokeStyle = "rgba(116,235,255,.55)"; ctx.beginPath(); ctx.arc(0, 0, deckLength * .54, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    } else if (imageReady(this.assets.tower)) {
      const atlas = this.assets.tower;
      const cellWidth = atlas.naturalWidth / 2;
      const cellHeight = atlas.naturalHeight / 2;
      const column = tier % 2;
      const row = Math.floor(tier / 2);
      const size = [142, 166, 192, 220][tier];
      const sourceHeight = tier === 1 ? Math.min(cellHeight, 520) : cellHeight;
      const drawHeight = size * (sourceHeight / cellHeight);
      ctx.shadowColor = overload ? "#d996ff" : "#71e8ff";
      ctx.shadowBlur = 12 + tier * 5;
      ctx.drawImage(atlas, column * cellWidth, row * cellHeight, cellWidth, sourceHeight, -size / 2, -size / 2, size, drawHeight);
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
    this.drawTowerRouteModules(ctx, state, visual, tier);
    this.drawTowerAim(ctx, state, visual, tier);
    if (tier < 3 && !isChapterTwo(state)) this.drawElementModules(ctx, state, tier);
    this.drawTowerSkillMechanics(ctx, state, visual, tier);
    this.drawTowerDamage(ctx, state, visual, tier);

    if (crystalShieldRatio > 0) {
      this.drawTowerCrystalShield(ctx, tier, crystalShieldRatio, state.skills.heal.shieldBurstArmed, true);
    }

    ctx.restore();
    this.drawTowerHealthBar(ctx, state, x, y, towerScale * towerArtScale, tier, stats);
  }

  drawTowerCrystalShield(ctx, tier, ratio, armed, foreground) {
    const frame = Math.floor(this.time * 24);
    const ratioBucket = Math.round(ratio * 12) / 12;
    const cacheKey = `${tier}:${ratioBucket}:${armed ? 1 : 0}`;
    if (!this.crystalShieldCache || this.crystalShieldCache.key !== cacheKey) {
      this.crystalShieldCache = { key: cacheKey, background: null, foreground: null, backgroundFrame: -1, foregroundFrame: -1 };
    }
    const cacheSlot = foreground ? "foreground" : "background";
    const frameSlot = `${cacheSlot}Frame`;
    let sprite = this.crystalShieldCache[cacheSlot];
    if (!sprite) {
      const size = 280;
      sprite = createEffectCanvas(size, size);
      if (sprite) {
        this.crystalShieldCache[cacheSlot] = sprite;
      }
    }
    if (sprite) {
      if (this.crystalShieldCache[frameSlot] !== frame) {
        const spriteCtx = sprite.getContext("2d");
        spriteCtx.setTransform(1, 0, 0, 1, 0, 0);
        spriteCtx.clearRect(0, 0, sprite.width, sprite.height);
        spriteCtx.translate(sprite.width / 2, sprite.height / 2);
        this.drawTowerCrystalShieldDirect(spriteCtx, tier, ratioBucket, armed, foreground);
        this.crystalShieldCache[frameSlot] = frame;
      }
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(sprite, -140, -140);
      ctx.restore();
      return;
    }
    this.drawTowerCrystalShieldDirect(ctx, tier, ratio, armed, foreground);
  }

  drawTowerCrystalShieldDirect(ctx, tier, ratio, armed, foreground) {
    const radius = 69 + tier * 10;
    const breath = Math.sin(this.time * 2.2) * 1.5;
    const shellRadius = radius + breath;
    const segmentCount = 12;
    const activeSegments = Math.max(1, Math.ceil(ratio * segmentCount));

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    if (!foreground) {
      // 背景层只需要提供范围感，避免每帧创建径向渐变。
      ctx.globalAlpha = .06 + ratio * .08;
      ctx.fillStyle = armed ? "#dfffff" : "#35d7ff";
      ctx.beginPath(); ctx.arc(0, 0, shellRadius + 7, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .18 + ratio * .13;
      ctx.strokeStyle = "#70e8ff";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 10]);
      ctx.beginPath();
      ctx.ellipse(0, 0, shellRadius + 2, shellRadius * .53, .22, 0, Math.PI * 2);
      ctx.ellipse(0, 0, shellRadius + 2, shellRadius * .53, -1.05, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }

    const pulse = .5 + Math.sin(this.time * 3.6) * .5;
    const liveColor = armed ? "#eaffff" : "#8cefff";
    const liveStroke = armed ? "#f1ffff" : "#75edff";
    const dimColor = "#3d8eac";
    const dimStroke = "#4c91aa";
    const drawDiamondPath = (predicate, fill, stroke, alpha, lineWidth) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for (let plate = 0; plate < 6; plate += 1) {
        if (!predicate(plate)) continue;
        const angle = -Math.PI / 2 + plate * Math.PI / 3;
        const plateRadius = shellRadius + 1 + Math.sin(this.time * 2.8 + plate) * 1.2;
        const radialX = Math.cos(angle);
        const radialY = Math.sin(angle);
        const tangentX = -radialY;
        const tangentY = radialX;
        const px = radialX * plateRadius;
        const py = radialY * plateRadius;
        const add = (radial, tangent, move = false) => {
          const pointX = px + radialX * radial + tangentX * tangent;
          const pointY = py + radialY * radial + tangentY * tangent;
          if (move) ctx.moveTo(pointX, pointY);
          else ctx.lineTo(pointX, pointY);
        };
        add(8 + pulse * 2, 0, true); add(0, -4); add(-8 - pulse * 2, 0); add(0, 4); ctx.closePath();
      }
      ctx.fill(); ctx.stroke();
    };

    // 只给外壳保留一次弱阴影，内部结构线全部关闭阴影。
    ctx.globalAlpha = .22 + ratio * .16;
    ctx.strokeStyle = liveStroke;
    ctx.shadowColor = armed ? "#d8ffff" : "#64e7ff";
    ctx.shadowBlur = armed ? 12 : 8;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, shellRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = .08 + ratio * .08 + pulse * .025;
    ctx.fillStyle = armed ? "#dcffff" : "#72eaff";
    ctx.beginPath();
    for (let side = 0; side < 6; side += 1) {
      const angle = -Math.PI / 2 + Math.PI / 6 + side * Math.PI / 3;
      const px = Math.cos(angle) * (shellRadius - 4);
      const py = Math.sin(angle) * (shellRadius - 4);
      side ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();

    // 晶片、能量肋骨和分段弧线分别合并成少量路径。
    drawDiamondPath((plate) => plate * 2 < activeSegments, liveColor, liveStroke, .58 + ratio * .3 + pulse * .08, 1.5);
    drawDiamondPath((plate) => plate * 2 >= activeSegments, dimColor, dimStroke, .17, .75);

    ctx.globalAlpha = .22 + ratio * .2;
    ctx.strokeStyle = liveStroke;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    for (let plate = 0; plate < 6; plate += 1) {
      if (plate * 2 >= activeSegments) continue;
      const angle = -Math.PI / 2 + plate * Math.PI / 3;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * (shellRadius - 8), Math.sin(angle) * (shellRadius - 8));
    }
    ctx.stroke();

    ctx.globalAlpha = .3 + ratio * .28 + pulse * .08;
    ctx.strokeStyle = liveStroke;
    ctx.lineWidth = 1.1;
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = -this.time * 12;
    ctx.beginPath();
    for (let side = 0; side < 6; side += 1) {
      const angle = -Math.PI / 2 + side * Math.PI / 3;
      const px = Math.cos(angle) * (shellRadius - 4);
      const py = Math.sin(angle) * (shellRadius - 4);
      side ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);

    const drawSegments = (lit) => {
      ctx.globalAlpha = lit ? .58 + ratio * .34 : .13;
      ctx.strokeStyle = lit ? liveStroke : dimStroke;
      ctx.lineWidth = lit ? 2.7 : .9;
      ctx.beginPath();
      for (let index = 0; index < segmentCount; index += 1) {
        if ((index < activeSegments) !== lit) continue;
        const start = -Math.PI / 2 + index * Math.PI * 2 / segmentCount + .035;
        const end = start + Math.PI * 2 / segmentCount - .07;
        ctx.arc(0, 0, shellRadius, start, end);
      }
      ctx.stroke();
    };
    drawSegments(true);
    drawSegments(false);

    ctx.globalAlpha = .48 + ratio * .25;
    ctx.strokeStyle = "#d9fdff";
    ctx.lineWidth = 1.35;
    ctx.setLineDash([18, 48]);
    ctx.lineDashOffset = -this.time * 18;
    ctx.beginPath(); ctx.arc(0, 0, shellRadius + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = .46 + ratio * .34;
    ctx.strokeStyle = "#f1ffff";
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, shellRadius - 2, -2.72, -1.78); ctx.stroke();
    ctx.globalAlpha *= .58;
    ctx.beginPath(); ctx.arc(0, 0, shellRadius - 2, .35, .93); ctx.stroke();

    if (armed) {
      const armedPulse = .76 + Math.sin(this.time * 5.2) * .2;
      ctx.globalAlpha = armedPulse;
      ctx.fillStyle = "#eaffff";
      ctx.strokeStyle = "#7feeff";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (let index = 0; index < 4; index += 1) {
        const angle = this.time * .28 + index * Math.PI / 2;
        const shardRadius = shellRadius + 10;
        const radialX = Math.cos(angle);
        const radialY = Math.sin(angle);
        const tangentX = -radialY;
        const tangentY = radialX;
        const px = radialX * shardRadius;
        const py = radialY * shardRadius;
        ctx.moveTo(px + radialX * 5, py + radialY * 5);
        ctx.lineTo(px + tangentX * 3, py + tangentY * 3);
        ctx.lineTo(px - radialX * 5, py - radialY * 5);
        ctx.lineTo(px - tangentX * 3, py - tangentY * 3);
        ctx.closePath();
      }
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  drawTowerHealthBar(ctx, state, x, y, towerScale, tier, stats) {
    const timer = Math.max(0, Number(state.tower.healthBarTimer) || 0);
    if (timer <= 0) return;
    const duration = GAME_CONFIG.tower.healthBarDuration;
    const alpha = Math.min(1, timer / 0.35, (duration - timer) / 0.12);
    if (alpha <= 0) return;
    const hpRatio = Math.max(0, Math.min(1, state.tower.hp / stats.maxHp));
    const shieldRatio = Math.max(0, Math.min(1, (state.tower.shield || 0) / (stats.maxHp * GAME_CONFIG.skills.heal.shieldCapFraction)));
    const top = [62, 82, 124, 143][Math.min(3, tier)] * towerScale;
    const width = 154 + Math.min(3, tier) * 12;
    const height = 9;
    const left = x - width / 2;
    const barY = y - top - 18;
    const low = hpRatio < 0.35;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = low ? '#ff4f70' : '#72e8ff';
    ctx.shadowBlur = low ? 12 + Math.sin(this.time * 8) * 4 : 9;
    ctx.fillStyle = 'rgba(5,7,25,.9)';
    ctx.beginPath(); ctx.roundRect(left - 3, barY - 3, width + 6, height + 6, 6); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(left, barY, width, height, 4); ctx.clip();
    ctx.fillStyle = low ? '#ff4b6c' : hpRatio < 0.6 ? '#ffca5e' : '#58dfa1';
    ctx.fillRect(left, barY, width * hpRatio, height);
    if (shieldRatio > 0) { ctx.fillStyle = 'rgba(143,239,255,.82)'; ctx.fillRect(left, barY, width * shieldRatio, 2); }
    ctx.restore();
    ctx.lineWidth = low ? 1.5 : 1;
    ctx.strokeStyle = low ? 'rgba(255,102,126,.95)' : 'rgba(191,247,255,.7)';
    ctx.beginPath(); ctx.roundRect(left, barY, width, height, 4); ctx.stroke();
    ctx.font = '800 9px ui-monospace, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = low ? '#ff9eac' : '#d7efff';
    ctx.fillText(String(Math.ceil(hpRatio * 100)) + '%', left + width, barY - 8);
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
    const boss = state.enemies.find((enemy) => enemy.type === "sovereign" && enemy.hp > 0)
      ?? state.enemies.find((enemy) => enemy.type === "colossus" && enemy.hp > 0)
      ?? state.enemies.find((enemy) => enemy.type === "boss" && enemy.hp > 0);
    if (!boss) return;
    const { width } = GAME_CONFIG.arena;
    const isColossus = boss.type === "colossus";
    const isSovereign = boss.type === "sovereign";
    const shifted = !isColossus && !isSovereign && (state.wave.warningStarted || state.wave.active);
    const y = shifted ? 92 : 20;
    const barWidth = 390;
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(18,4,20,.9)";
    ctx.strokeStyle = isSovereign ? "rgba(255,38,91,.9)" : isColossus ? "rgba(255,74,132,.68)" : "rgba(255,180,95,.55)";
    const panelHeight = isSovereign ? 104 : isColossus ? 76 : 49;
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
    const title = isSovereign
      ? `裂界魔君 · ${boss.enraged ? "终末狂暴 · 元素无效" : COLOSSUS_SKILLS[boss.intentSkill ?? boss.activeSkill]?.name ?? "四重命核"}`
      : isColossus
      ? `虚环吞星兽 · ${colossusAffix.name} · ${boss.enraged ? `狂暴并行 · ${colossusAction}` : colossusAction}`
      : `腐化晶核领主 · ${resistanceNames[boss.resistance] ?? "未知"}抗性 · ${anchorSummary}`;
    ctx.fillText(title, width / 2, y + 5);
    const phaseColor = isSovereign ? (boss.enraged ? "#ff342e" : "#d948ff") : isColossus ? (boss.enraged ? "#ff4a2f" : COLOSSUS_AFFIXES[boss.colossusAffix]?.color ?? "#ff477c") : { frost: "#62dfff", fire: "#ff6749", lightning: "#aa83ff" }[boss.resistance] ?? "#ff4d67";
    const gradient = ctx.createLinearGradient(width / 2 - barWidth / 2, 0, width / 2 + barWidth / 2, 0);
    gradient.addColorStop(0, phaseColor); gradient.addColorStop(1, "#ffc45f");
    if (isSovereign) {
      const x = width / 2 - barWidth / 2;
      const shieldRatio = Math.max(0, (boss.spawnShield ?? 0) / (boss.spawnShieldMax || 1));
      ctx.fillStyle = "rgba(103,220,255,.13)"; ctx.fillRect(x, y + 13, barWidth, 5);
      ctx.fillStyle = "#8eeeff"; ctx.shadowColor = "#4c8dff"; ctx.shadowBlur = 9; ctx.fillRect(x, y + 13, barWidth * shieldRatio, 5); ctx.shadowBlur = 0;
      const labels = ["Ⅳ", "Ⅲ", "Ⅱ", "Ⅰ"];
      labels.forEach((label, index) => {
        const representedBar = 4 - index;
        const barRatio = boss.healthBar > representedBar ? 1 : boss.healthBar === representedBar ? ratio : 0;
        const barY = y + 22 + index * 13;
        ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(x, barY, barWidth, 8);
        ctx.fillStyle = gradient; ctx.fillRect(x, barY, barWidth * barRatio, 8);
        ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.font = "900 9px ui-monospace, monospace"; ctx.fillText(label, x + 5, barY + 7);
      });
      ctx.textAlign = "center"; ctx.font = "800 10px 'Microsoft YaHei UI', sans-serif";
      ctx.fillStyle = shieldRatio > 0 ? "#a9f6ff" : boss.enraged ? "#ff6b4e" : boss.healthBar <= 2 ? "#ffd45d" : (state.tower.fireRateSuppression ?? 0) > 0 ? "#ff8d79" : "#e5b9ff";
      const status = boss.entryTimer > 0 ? `时流锁定 1× · 双方停火 ${boss.entryTimer.toFixed(1)}s` : shieldRatio > 0 ? `降临护盾 ${Math.ceil(shieldRatio * 100)}% · 击破后强制召唤` : boss.enraged ? "最后命核开启 · 终末狂暴 · 元素与异常全部失效" : boss.healthBar <= 2 ? "裂隙增殖 · 每波混入词缀精英" : (state.tower.fireRateSuppression ?? 0) > 0 ? `晶矢频率受压制 · ${state.tower.fireRateSuppression.toFixed(1)}s` : `剩余命核 ${boss.healthBar}/4 · 优先施放多重裂隙`;
      ctx.fillText(status, width / 2, y + 88);
    } else if (isColossus) {
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
