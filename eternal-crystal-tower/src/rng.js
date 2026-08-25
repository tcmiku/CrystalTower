export class SeededRng {
  constructor(seed = 1) {
    this.state = (Number(seed) >>> 0) || 1;
  }

  next() {
    let value = this.state += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    this.state = this.state >>> 0;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
}

export function seedFromUrl(search = "") {
  const params = new URLSearchParams(search);
  const explicit = Number.parseInt(params.get("seed"), 10);
  if (Number.isFinite(explicit)) return explicit >>> 0 || 1;
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1;
}

