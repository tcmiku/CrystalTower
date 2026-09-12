import { meshBuilder, TowerModelRenderer } from './tower-model.js';

const TAU = Math.PI * 2;

const ROCK = [.16, .10, .24];
const ROCK_MID = [.24, .14, .34];
const ROCK_DARK = [.09, .05, .14];
const LAVA = [1, .18, .04];
const LAVA_HOT = [1, .48, .10];
const EMBER = [1, .82, .32];
const CRYSTAL = [.72, .05, .20];
const CRYSTAL_DEEP = [.42, .02, .12];
const PURPLE_BODY = [.20, .11, .32];
const PURPLE_GLOW = [.62, .24, .95];
const VIOLET = [.80, .48, 1];
const ORANGE_BODY = [.30, .13, .16];
const ORANGE_GLOW = [1, .45, .10];

export const ENEMY_MODEL_TYPES = ['wisp', 'runner', 'brute', 'crawler', 'sentinel', 'hexer', 'rammer', 'inkHound', 'orbitMote', 'rustBeetle'];

const ENEMY_LAYOUTS = {
  wisp: { radius: 22, mountHeight: 0 },
  runner: { radius: 26, mountHeight: 0 },
  brute: { radius: 32, mountHeight: 0 },
  crawler: { radius: 22, mountHeight: 0 },
  sentinel: { radius: 34, mountHeight: 0 },
  hexer: { radius: 24, mountHeight: 0 },
  rammer: { radius: 30, mountHeight: 0 },
  inkHound: { radius: 28, mountHeight: 0 },
  orbitMote: { radius: 29, mountHeight: 0 },
  rustBeetle: { radius: 33, mountHeight: 0 }
};

function shade(color, k) { return color.map(v => Math.min(1, v * k)); }

function gem(m, cx, cy, cz, rx, ry, rz, color, glow = 0, rings = 5, segs = 10) {
  const p = (a, b) => [cx + rx * Math.sin(b) * Math.cos(a), cy + ry * Math.cos(b), cz + rz * Math.sin(b) * Math.sin(a)];
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) {
    const a = i * TAU / segs, b = (i + 1) * TAU / segs;
    const c = j * Math.PI / rings, d = (j + 1) * Math.PI / rings;
    const faceColor = shade(color, .86 + ((i + j) % 3) * .08);
    m.face([p(a, c), p(a, d), p(b, d)], faceColor, glow);
    m.face([p(a, c), p(b, d), p(b, c)], faceColor, glow);
  }
}

function limb(m, hip, knee, foot, thick, armor = ROCK, joint = LAVA, footArmor = CRYSTAL_DEEP) {
  const th = thick;
  m.box(hip[0], Math.min(hip[1], knee[1]), hip[2] - th * .45, Math.abs(hip[0] - knee[0]) + th * .3, Math.abs(hip[1] - knee[1]) + th * .25, th * .9, armor);
  m.box(knee[0], Math.min(knee[1], foot[1]), knee[2] - th * .4, Math.abs(knee[0] - foot[0]) + th * .25, Math.abs(knee[1] - foot[1]) + th * .2, th * .8, shade(armor, .85));
  gem(m, (hip[0] + foot[0]) * .5, knee[1] + th * .1, (hip[2] + foot[2]) * .5, th * .55, th * .45, th * .45, joint, .55, 4, 8);
  m.box(foot[0] - th * .3, foot[1] - th * .15, foot[2] - th * .35, th * 1.1, th * .4, th * .7, footArmor);
}

function claw(m, root, mid, tip, width, armor = ROCK, edge = CRYSTAL, glowColor = LAVA) {
  const w = width;
  m.face([root, [root[0], root[1] + w * .5, root[2] + w * .35], [mid[0], mid[1] + w * .35, mid[2] + w * .4], [tip[0], tip[1] + w * .1, tip[2]], tip], armor);
  m.face([root, tip, [tip[0] - 1, tip[1] - w * .1, tip[2] - w * .3], [mid[0], mid[1] - w * .1, mid[2] - w * .35]], ROCK_DARK);
  m.face([[mid[0], mid[1] + w * .2, mid[2] + w * .4], tip, [tip[0] - 2, tip[1] + w * .05, tip[2] + w * .15]], edge, .35);
  m.face([[root[0], root[1] + w * .2, root[2]], [mid[0], mid[1] + w * .15, mid[2] - w * .1], tip], glowColor, .5);
}

function spineCrystals(m, points, colors) {
  for (const [x, y, z, r, h, tilt] of points) m.crystal(x, y, z, r, h, tilt, colors);
}

export function buildWispModel() {
  const m = meshBuilder();
  gem(m, 0, 0, 0, 17, 15, 15, LAVA, .5, 6, 12);
  for (let j = 0; j < 7; j++) {
    const lat = (j / 6 - .5) * Math.PI * .92;
    const y = Math.sin(lat) * 16;
    const rr = Math.cos(lat) * 16;
    const ringCount = Math.max(4, Math.round(10 * Math.cos(lat)));
    for (let i = 0; i < ringCount; i++) {
      const a = TAU * i / ringCount + (j % 2) * .18;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (x > 10 && Math.abs(y) < 8 && Math.abs(z) < 9) continue;
      gem(m, x * 1.02, y * 1.02, z * 1.02, 5.2, 4.6, 4.6, shade(ROCK_MID, .9 + (i % 3) * .08), 0, 4, 8);
    }
  }
  gem(m, 16, 0, 0, 5.5, 9, 9, CRYSTAL_DEEP, .25, 5, 10);
  gem(m, 20, 0, 0, 2.8, 6, 6, LAVA_HOT, 1, 5, 10);
  gem(m, 23, 0, 0, 1.4, 3, 3, EMBER, 1, 4, 8);
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    claw(m, [8, sy * 8, sz * 11], [16, sy * 14, sz * 18], [30, sy * 4, sz * 14], 8, ROCK, CRYSTAL, LAVA);
  }
  for (let i = 0; i < 6; i++) {
    const a = TAU * i / 6;
    m.crystal(-8 + Math.cos(a) * 4, 10 + (i % 2) * 2, Math.sin(a) * 8, 3.5, 11 + (i % 3) * 2, Math.cos(a) * .5, [CRYSTAL_DEEP, CRYSTAL, LAVA]);
  }
  return { layout: ENEMY_LAYOUTS.wisp, parts: [{ name: 'Wisp rock armor, molten eye and crystal claws', vertices: new Float32Array(m.data) }] };
}

export function buildRunnerModel() {
  const m = meshBuilder();
  // Long low body — arrow silhouette along +X.
  gem(m, -4, 7, 0, 30, 9, 11, ROCK, 0, 5, 12);
  gem(m, 2, 8, 0, 20, 8, 9, ROCK_MID, 0, 5, 10);
  gem(m, -18, 7, 0, 12, 7, 8, ROCK_DARK, 0, 4, 8);
  // Wide angular head that tapers to a sharp nose (reads as arrow from above).
  m.face([
    [16, 11, -12], [28, 10, -14], [42, 7, -6], [52, 5, 0],
    [42, 7, 6], [28, 10, 14], [16, 11, 12]
  ], ROCK_MID);
  m.face([[16, 4, -10], [28, 3, -12], [44, 3, -4], [52, 2, 0], [44, 3, 4], [28, 3, 12], [16, 4, 10]], ROCK_DARK);
  // Brow ridge and jaw.
  m.face([[22, 12, -8], [36, 9, -5], [48, 5, 0], [36, 9, 5], [22, 12, 8], [24, 8, 0]], ROCK);
  m.face([[30, 5, -6], [48, 3, 0], [30, 5, 6]], CRYSTAL, .35);
  // Eyes and mouth glow.
  gem(m, 34, 8, -7, 2.6, 2.4, 2.4, LAVA_HOT, .95, 4, 8);
  gem(m, 34, 8, 7, 2.6, 2.4, 2.4, LAVA_HOT, .95, 4, 8);
  m.face([[40, 3, -4], [52, 2, 0], [40, 3, 4]], LAVA, .7);
  // Flank molten cracks.
  for (const side of [-1, 1]) {
    m.face([[0, 8, side * 10], [12, 9, side * 9], [18, 6, side * 7], [6, 5, side * 9]], LAVA, .4);
    m.face([[-12, 7, side * 9], [-4, 9, side * 8], [-6, 5, side * 8]], LAVA, .3);
  }
  limb(m, [14, 4, 10], [20, -3, 14], [26, -1, 12], 5, ROCK, LAVA);
  limb(m, [14, 4, -10], [20, -3, -14], [26, -1, -12], 5, ROCK, LAVA);
  limb(m, [-10, 4, 9], [-8, -4, 13], [-2, -1, 11], 5.5, ROCK_MID, LAVA);
  limb(m, [-10, 4, -9], [-8, -4, -13], [-2, -1, -11], 5.5, ROCK_MID, LAVA);
  spineCrystals(m, [
    [-20, 13, 0, 3.5, 12, -.3], [-12, 15, 0, 4, 16, -.4], [-4, 16, 0, 4.5, 20, -.5],
    [4, 15, 0, 4, 17, -.4], [12, 13, 0, 3.5, 13, -.3]
  ], [CRYSTAL_DEEP, CRYSTAL, LAVA]);
  // Lateral arrow fins.
  for (const side of [-1, 1]) {
    m.face([[6, 10, side * 8], [16, 13, side * 18], [22, 8, side * 12]], CRYSTAL);
    m.face([[6, 7, side * 8], [16, 11, side * 18], [14, 4, side * 12]], ROCK);
    m.face([[16, 13, side * 18], [22, 8, side * 12], [18, 5, side * 10]], LAVA, .35);
  }
  // Tail blades.
  m.face([[-24, 9, 0], [-34, 16, -7], [-38, 5, 0], [-34, 16, 7]], CRYSTAL);
  m.face([[-34, 16, -7], [-40, 8, 0], [-34, 16, 7]], LAVA, .45);
  return { layout: ENEMY_LAYOUTS.runner, parts: [{ name: 'Runner elongated arrow quadruped', vertices: new Float32Array(m.data) }] };
}

export function buildBruteModel() {
  const m = meshBuilder();
  gem(m, -4, 12, 0, 24, 14, 22, ROCK, 0, 5, 12);
  gem(m, -6, 15, 0, 18, 12, 17, ROCK_MID, 0, 5, 10);
  gem(m, 16, 11, 0, 13, 10, 12, ROCK_DARK, 0, 5, 10);
  gem(m, 22, 10, -6, 3.2, 2.8, 2.8, LAVA_HOT, .9, 4, 8);
  gem(m, 22, 10, 6, 3.2, 2.8, 2.8, LAVA_HOT, .9, 4, 8);
  m.face([[16, 5, -9], [30, 6, -5], [28, 2, 5], [14, 3, 9]], CRYSTAL);
  // Massive forelimbs: thick arm mass ending in oversized crystal claws.
  for (const side of [-1, 1]) {
    const z = side * 14;
    // Upper arm
    m.box(6, 6, z - 7, 16, 12, 14, ROCK);
    m.box(8, 10, z - 5, 12, 6, 10, ROCK_MID);
    // Forearm sweeping forward-outward
    m.box(18, 4, z - 8 + side * 4, 18, 10, 12, ROCK);
    // Claw wedge (thick, not a flat blade)
    const cx = 34, cz = z + side * 8;
    m.face([[cx, 8, cz - 6], [cx + 10, 6, cz - 4], [cx + 22, 3, cz + side * 2], [cx + 8, 2, cz + 6], [cx, 3, cz + 5]], ROCK);
    m.face([[cx + 4, 8, cz - 4], [cx + 22, 3, cz + side * 2], [cx + 10, 2, cz + 4]], CRYSTAL, .25);
    m.face([[cx + 14, 5, cz - 2], [cx + 26, 1, cz + side * 3], [cx + 12, 1, cz + 3]], LAVA, .45);
    m.crystal(cx + 12, 10, cz, 5, 14, side * .9, [CRYSTAL_DEEP, CRYSTAL, LAVA]);
    // Shoulder crystal
    m.crystal(2, 22, z, 6.5, 20, side * .85, [CRYSTAL_DEEP, CRYSTAL, LAVA]);
  }
  limb(m, [8, 2, 18], [14, -6, 22], [20, -2, 19], 9, ROCK, LAVA);
  limb(m, [8, 2, -18], [14, -6, -22], [20, -2, -19], 9, ROCK, LAVA);
  limb(m, [-16, 2, 17], [-14, -8, 21], [-8, -2, 18], 9.5, ROCK_MID, LAVA);
  limb(m, [-16, 2, -17], [-14, -8, -21], [-8, -2, -18], 9.5, ROCK_MID, LAVA);
  for (let i = 0; i < 7; i++) {
    const a = TAU * i / 7 + .2;
    m.crystal(-6 + Math.cos(a) * 12, 24, Math.sin(a) * 13, 5.5, 16 + (i % 3) * 4, Math.cos(a) * .9, [CRYSTAL_DEEP, CRYSTAL, LAVA]);
  }
  gem(m, -4, 22, 0, 6, 5, 6, LAVA, .55, 4, 8);
  gem(m, -4, 26, 0, 3, 3.5, 3, EMBER, .9, 4, 8);
  for (let i = 0; i < 4; i++) {
    const z = -12 + i * 8;
    m.face([[-12, 3, z], [10, 2, z + 1], [14, 5, z - 1], [-8, 6, z - 2]], LAVA, .35);
  }
  return { layout: ENEMY_LAYOUTS.brute, parts: [{ name: 'Brute heavy armor mass with oversized claws', vertices: new Float32Array(m.data) }] };
}

export function buildCrawlerModel() {
  const m = meshBuilder();
  gem(m, 0, 5, 0, 18, 12, 16, ROCK, 0, 5, 12);
  gem(m, 0, 7, 0, 13, 9, 12, ROCK_MID, 0, 5, 10);
  gem(m, 14, 5, 0, 8, 6, 7, ROCK_DARK, 0, 4, 8);
  gem(m, 18, 5, -3, 2.4, 2.2, 2.2, LAVA_HOT, .95, 4, 8);
  gem(m, 18, 5, 3, 2.4, 2.2, 2.2, LAVA_HOT, .95, 4, 8);
  gem(m, 0, 9, 0, 4.5, 3.5, 4.5, LAVA, .55, 4, 8);
  // Six radial crab legs with claw tips.
  for (let i = 0; i < 6; i++) {
    const a = TAU * i / 6 + .25;
    const hx = Math.cos(a) * 12, hz = Math.sin(a) * 12;
    const kx = Math.cos(a) * 20, kz = Math.sin(a) * 20;
    const fx = Math.cos(a) * 28, fz = Math.sin(a) * 28;
    limb(m, [hx, 4, hz], [kx, -2, kz], [fx, -1, fz], 3.8, i % 2 ? ROCK : ROCK_MID, LAVA);
    m.crystal(fx, 1, fz, 2.6, 9 + (i % 2) * 3, a, [CRYSTAL_DEEP, CRYSTAL, LAVA]);
  }
  for (const side of [-1, 1]) {
    claw(m, [-10, 5, side * 8], [-20, 11, side * 16], [-30, 4, side * 13], 5, ROCK, CRYSTAL, LAVA);
  }
  for (let i = 0; i < 5; i++) {
    const z = -8 + i * 4;
    m.crystal(-6 + (i % 2) * 5, 13, z, 3, 10 + (i % 3) * 3, -.55, [CRYSTAL_DEEP, CRYSTAL, LAVA]);
  }
  return { layout: ENEMY_LAYOUTS.crawler, parts: [{ name: 'Crawler multi-legged crab shell', vertices: new Float32Array(m.data) }] };
}

export function buildSentinelModel() {
  const m = meshBuilder();
  gem(m, 0, 14, 0, 24, 15, 18, ROCK, 0, 5, 12);
  gem(m, 2, 17, 0, 19, 13, 14, ROCK_MID, 0, 5, 10);
  gem(m, 18, 15, 0, 12, 11, 11, ROCK_DARK, 0, 5, 10);
  gem(m, 24, 15, -4, 2.8, 2.5, 2.5, LAVA_HOT, .9, 4, 8);
  gem(m, 24, 15, 4, 2.8, 2.5, 2.5, LAVA_HOT, .9, 4, 8);
  m.face([[16, 9, -10], [30, 10, -6], [28, 6, 6], [14, 7, 10]], CRYSTAL);
  // Large side shield crystals (warden silhouette).
  for (const side of [-1, 1]) {
    const z = side * 16;
    m.box(0, 8, z - 4, 28, 16, 7, ROCK);
    m.box(2, 12, z - 3, 24, 9, 3.5, ROCK_MID);
    m.crystal(8, 24, z + side, 7, 22, side * .95, [CRYSTAL_DEEP, CRYSTAL, LAVA]);
    m.crystal(-8, 22, z * .9, 5.5, 18, side * .7, [PURPLE_BODY, CRYSTAL, LAVA]);
    gem(m, 14, 14, z + side * 2, 4, 4.5, 3, LAVA, .5, 4, 8);
  }
  limb(m, [12, 5, 13], [16, -4, 17], [22, -2, 15], 6.5, ROCK, LAVA);
  limb(m, [12, 5, -13], [16, -4, -17], [22, -2, -15], 6.5, ROCK, LAVA);
  limb(m, [-12, 5, 13], [-10, -6, 17], [-4, -2, 14], 7, ROCK_MID, LAVA);
  limb(m, [-12, 5, -13], [-10, -6, -17], [-4, -2, -14], 7, ROCK_MID, LAVA);
  spineCrystals(m, [
    [-16, 26, 0, 4, 16, -.3], [-8, 28, 0, 5, 22, -.4], [0, 30, 0, 5.5, 26, -.45],
    [8, 28, 0, 5, 22, -.4], [14, 25, 0, 4, 16, -.3]
  ], [CRYSTAL_DEEP, CRYSTAL, LAVA]);
  gem(m, -2, 28, 0, 5, 4, 5, LAVA, .55, 4, 8);
  return { layout: ENEMY_LAYOUTS.sentinel, parts: [{ name: 'Sentinel heavy shield carapace', vertices: new Float32Array(m.data) }] };
}

export function buildHexerModel() {
  const m = meshBuilder();
  gem(m, 0, 4, 0, 16, 15, 16, PURPLE_BODY, 0, 6, 12);
  gem(m, 0, 5, 0, 12, 12, 12, [.28, .12, .42], 0, 5, 10);
  gem(m, 14, 3, 0, 4.5, 8, 8, [.45, .08, .55], .35, 5, 10);
  gem(m, 17, 3, 0, 2.2, 5.5, 5.5, PURPLE_GLOW, 1, 5, 10);
  gem(m, 19, 3, 0, 1.2, 2.8, 2.8, VIOLET, 1, 4, 8);
  // Three orbit crystals (static mesh positions).
  for (let i = 0; i < 3; i++) {
    const a = TAU * i / 3 + .4;
    const ox = Math.cos(a) * 26, oz = Math.sin(a) * 26, oy = 10 + (i % 2) * 6;
    m.ring(ox, oy - 2, oz, 5, 3, 2, VIOLET, 10);
    m.crystal(ox, oy, oz, 3.5, 12, 0, [PURPLE_BODY, PURPLE_GLOW, VIOLET]);
    gem(m, ox, oy + 8, oz, 2, 2, 2, VIOLET, 1, 4, 8);
  }
  for (const z of [-1, 1]) for (const y of [-1, 1]) {
    claw(m, [6, y * 7, z * 9], [13, y * 12, z * 15], [22, y * 4, z * 12], 3.5, PURPLE_BODY, PURPLE_GLOW, PURPLE_GLOW);
  }
  for (let i = 0; i < 5; i++) {
    const a = TAU * i / 5;
    m.crystal(Math.cos(a) * 10, 14, Math.sin(a) * 10, 3.2, 12 + (i % 3) * 3, Math.cos(a) * .8, [PURPLE_BODY, PURPLE_GLOW, VIOLET]);
  }
  m.ring(0, 18, 0, 8, 5, 2, VIOLET, 14);
  gem(m, 0, 20, 0, 3.5, 3.5, 3.5, PURPLE_GLOW, .9, 4, 8);
  return { layout: ENEMY_LAYOUTS.hexer, parts: [{ name: 'Hexer orbit crystal caster', vertices: new Float32Array(m.data) }] };
}

export function buildRammerModel() {
  const m = meshBuilder();
  // Lower, longer body than brute — built to charge.
  gem(m, -4, 9, 0, 26, 12, 15, ORANGE_BODY, 0, 5, 12);
  gem(m, -6, 11, 0, 20, 10, 12, [.28, .12, .16], 0, 5, 10);
  gem(m, 16, 8, 0, 12, 9, 10, ROCK_DARK, 0, 5, 10);
  gem(m, 22, 8, -4, 3, 2.6, 2.6, ORANGE_GLOW, .95, 4, 8);
  gem(m, 22, 8, 4, 3, 2.6, 2.6, ORANGE_GLOW, .95, 4, 8);
  // Giant forward charge horn.
  m.face([[18, 12, -7], [36, 14, -5], [58, 7, 0], [36, 14, 5], [18, 12, 7], [22, 5, 0]], ROCK);
  m.face([[28, 13, -4], [58, 7, 0], [28, 13, 4]], CRYSTAL);
  m.face([[40, 11, -3], [64, 5, 0], [40, 11, 3]], ORANGE_GLOW, .75);
  m.crystal(50, 8, 0, 5, 16, 0, [CRYSTAL_DEEP, ORANGE_GLOW, EMBER]);
  for (const side of [-1, 1]) {
    const z = side * 13;
    m.face([[6, 12, z], [20, 10, z + side * 8], [34, 7, z + side * 4], [18, 5, z - side * 2]], ROCK);
    m.crystal(16, 14, z + side * 3, 5, 14, side * .8, [CRYSTAL_DEEP, CRYSTAL, ORANGE_GLOW]);
    gem(m, 10, 9, z, 4, 4, 3.5, ORANGE_GLOW, .45, 4, 8);
  }
  limb(m, [14, 3, 12], [18, -5, 15], [24, -2, 14], 6, ORANGE_BODY, ORANGE_GLOW);
  limb(m, [14, 3, -12], [18, -5, -15], [24, -2, -14], 6, ORANGE_BODY, ORANGE_GLOW);
  limb(m, [-12, 3, 11], [-10, -6, 14], [-4, -2, 13], 6.5, ORANGE_BODY, ORANGE_GLOW);
  limb(m, [-12, 3, -11], [-10, -6, -14], [-4, -2, -13], 6.5, ORANGE_BODY, ORANGE_GLOW);
  for (let i = 0; i < 5; i++) {
    const z = -8 + i * 4;
    m.crystal(-20 + (i % 2) * 4, 13, z, 3.5, 14 + (i % 3) * 3, -.75, [CRYSTAL_DEEP, CRYSTAL, ORANGE_GLOW]);
  }
  gem(m, -4, 16, 0, 5, 4, 5, ORANGE_GLOW, .5, 4, 8);
  for (let i = 0; i < 4; i++) {
    const z = -9 + i * 6;
    m.face([[-8, 3, z], [10, 2, z + 1], [14, 4, z - 1], [-4, 5, z - 1]], ORANGE_GLOW, .35);
  }
  return { layout: ENEMY_LAYOUTS.rammer, parts: [{ name: 'Rammer charge-horn beast', vertices: new Float32Array(m.data) }] };
}

export function buildInkHoundModel() {
  const m=meshBuilder(), ink=[.045,.12,.20], plate=[.14,.27,.35], cyan=[.12,.9,1];
  gem(m,-5,10,0,24,10,10,ink,0,4,10);
  gem(m,12,14,0,13,12,11,plate,0,4,8);
  gem(m,26,12,0,13,6,7,ink,0,4,8);
  for(const side of [-1,1]) {
    limb(m,[10,10,side*8],[18,1,side*12],[27,-5,side*11],4.5,plate,cyan,plate);
    limb(m,[-18,9,side*7],[-25,0,side*12],[-12,-5,side*12],5,ink,cyan,plate);
    m.crystal(15,21,side*7,4,17,-.7,[ink,plate,cyan]);
    gem(m,27,15,side*5,4,1.5,1.2,cyan,1,3,6);
    m.face([[-22,14,side*7],[-7,18,side*9],[8,16,side*9],[-4,14,side*10]],cyan,.7);
    claw(m,[28,8,side*5],[34,8,side*5],[36,3,side*4],3,plate,cyan,cyan);
  }
  claw(m,[-24,12,0],[-39,20,0],[-49,31,0],7,ink,plate,cyan);
  spineCrystals(m,[[-15,19,0,3,10,-.8],[-5,21,0,3,12,-.8],[5,23,0,3,10,-.8]],[ink,plate,cyan]);
  return {layout:ENEMY_LAYOUTS.inkHound,parts:[{name:'Ink hound, split ears and cyan veins',vertices:new Float32Array(m.data)}]};
}

export function buildOrbitMoteModel() {
  const m=meshBuilder(), shell=[.16,.12,.31], silver=[.67,.76,.9], light=[.68,.94,1];
  gem(m,0,4,0,11,16,11,shell,0,5,10);
  m.crystal(0,-8,0,8,30,.15,[light,[.4,.45,.9],silver]);
  // Two inclined orbital cages, with physical thickness and satellite prisms.
  for(let ringIndex=0;ringIndex<2;ringIndex++) {
    const orbit=meshBuilder();orbit.ring(0,-1,0,27,24,2,silver,32);
    orbit.ring(0,1,0,26,25,1,light,32);
    const tilt=ringIndex===0?.65:-.75;
    for(let i=0;i<orbit.data.length;i+=10) {
      for(const offset of [0,3]) {
        const y=orbit.data[i+offset+1],z=orbit.data[i+offset+2];
        orbit.data[i+offset+1]=y*Math.cos(tilt)-z*Math.sin(tilt)+(offset===0?4:0);
        orbit.data[i+offset+2]=y*Math.sin(tilt)+z*Math.cos(tilt);
      }
    }
    m.data.push(...orbit.data);
  }
  for(let i=0;i<3;i++) {const a=i*TAU/3;m.crystal(Math.cos(a)*29,-1,Math.sin(a)*29,4,13,a,[silver,light,shell]);}
  gem(m,12,5,0,3,5,5,light,1,4,8);
  return {layout:ENEMY_LAYOUTS.orbitMote,parts:[{name:'Orbit mote with crossed silver cages',vertices:new Float32Array(m.data)}]};
}

export function buildRustBeetleModel() {
  const m=meshBuilder(), rust=[.36,.17,.08], copper=[.55,.29,.12], dark=[.13,.10,.07], acid=[.65,1,.16];
  gem(m,-5,9,0,26,16,23,dark,0,5,12);
  for(const side of [-1,1]) {
    gem(m,-6,14,side*11,24,13,11,rust,0,4,10);
    for(let i=0;i<3;i++) {
      const x=-20+i*17;
      limb(m,[x,8,side*17],[x-4,-1,side*27],[x+5,-5,side*32],5,copper,acid,dark);
      m.box(x,18,side*15,5,3,12,copper,-side*.2);
      gem(m,x,20,side*19,2,2,2,acid,.7,3,6);
    }
    claw(m,[22,7,side*7],[36,10,side*16],[42,7,side*5],7,rust,copper,acid);
  }
  gem(m,22,9,0,10,8,13,dark,0,4,8);
  for(const side of [-1,1]) gem(m,29,12,side*7,2,2,3,acid,1,3,6);
  m.box(-6,25,0,39,2,2,acid);
  spineCrystals(m,[[-20,24,0,4,9,-.4],[-8,27,0,4,11,-.3],[5,25,0,4,9,-.2]],[rust,copper,acid]);
  return {layout:ENEMY_LAYOUTS.rustBeetle,parts:[{name:'Rust beetle, split shell and acid seams',vertices:new Float32Array(m.data)}]};
}

export function buildEnemyModel(type = 'wisp') {
  switch (type) {
    case 'runner': return buildRunnerModel();
    case 'brute': return buildBruteModel();
    case 'crawler': return buildCrawlerModel();
    case 'sentinel': return buildSentinelModel();
    case 'hexer': return buildHexerModel();
    case 'rammer': return buildRammerModel();
    case 'inkHound': return buildInkHoundModel();
    case 'orbitMote': return buildOrbitMoteModel();
    case 'rustBeetle': return buildRustBeetleModel();
    case 'wisp':
    default: return buildWispModel();
  }
}

export class EnemyModelRenderer extends TowerModelRenderer {
  constructor({resolution=256}={}) {
    super();
    if(this.canvas) {this.canvas.width=resolution;this.canvas.height=resolution;}
  }

  prepare(visual) {
    const type = typeof visual === 'string' ? visual : (visual?.enemyType ?? 'wisp');
    this.meshCache ??= new Map();
    if (!this.meshCache.has(type)) this.meshCache.set(type, buildEnemyModel(type));
    this.model = this.meshCache.get(type);
    if (this.key === type) return;
    this.key = type;
    if (!this.gl || this.lost) return;
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer);
    this.buffers = this.model.parts.map(part => {
      const buffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, part.vertices, this.gl.STATIC_DRAW);
      return buffer;
    });
  }

  drawEnemy(ctx, enemy, time, angle, scale = 1) {
    const type = enemy.type ?? 'wisp';
    const layout = ENEMY_LAYOUTS[type] ?? ENEMY_LAYOUTS.wisp;
    const size = (enemy.radius / 17) * scale * (22 / layout.radius);
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.scale(size, size);
    const hover = type === 'wisp' || type === 'hexer' || type === 'crawler' || type === 'orbitMote';
    const bob = hover ? Math.sin(time * 3 + enemy.id) * 2 : Math.sin(time * 2.2 + enemy.id) * .8;
    ctx.translate(0, -38 + bob);
    const yaw = Math.atan2(Math.sin(angle) / .6, Math.cos(angle));
    super.draw(
      ctx,
      { tier: 0, enemyType: type, overloadBand: 'off', hpRatio: enemy.hpRatio ?? 1 },
      0,
      time,
      { hit: enemy.hitFlash },
      yaw
    );
    ctx.restore();
  }
}
