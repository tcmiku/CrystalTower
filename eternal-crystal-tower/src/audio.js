export class AudioSynth {
  constructor(muted = false) {
    this.muted = muted;
    this.context = null;
    this.unlocked = false;
    this.lastShot = 0;
  }

  ensureContext() {
    if (this.context || this.muted || !this.unlocked) return this.context;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return null;
    this.context = new Context();
    return this.context;
  }

  unlock() {
    this.unlocked = true;
    const context = this.ensureContext();
    context?.resume();
    return context;
  }

  setMuted(value) {
    this.muted = value;
    if (!value) this.ensureContext()?.resume();
  }

  tone(frequency, duration, volume = 0.04, type = "sine", slide = 0) {
    const context = this.ensureContext();
    if (!context || this.muted) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  play(type) {
    if (this.muted) return;
    const now = performance.now();
    if (type === "shoot") {
      if (now - this.lastShot < 65) return;
      this.lastShot = now;
      this.tone(520, 0.06, 0.018, "triangle", 180);
    } else if (type === "hit") this.tone(130, 0.04, 0.012, "square", -40);
    else if (type === "kill") this.tone(260, 0.08, 0.025, "triangle", 180);
    else if (type === "coin") this.tone(720, 0.08, 0.025, "sine", 260);
    else if (type === "coinPick") this.tone(540, 0.05, 0.018, "triangle", 120);
    else if (type === "sawShoot") this.tone(390, 0.045, 0.014, "square", 90);
    else if (type === "purchase") { this.tone(360, 0.1, 0.04, "triangle", 260); setTimeout(() => this.tone(620, 0.1, 0.03, "triangle", 220), 55); }
    else if (type === "ascend") { this.tone(180, 0.45, 0.06, "sawtooth", 650); setTimeout(() => this.tone(630, 0.35, 0.05, "sine", 470), 80); }
    else if (type === "towerHit") this.tone(75, 0.14, 0.06, "square", -22);
    else if (type === "boss") this.tone(62, 0.75, 0.09, "sawtooth", -20);
    else if (type === "phase") this.tone(310, 0.38, 0.035, "sine", 310);
    else if (type === "waveWarning") { this.tone(105, 0.32, 0.055, "square", -18); setTimeout(() => this.tone(105, 0.32, 0.055, "square", -18), 420); }
    else if (type === "waveStart") this.tone(72, 0.72, 0.085, "sawtooth", -24);
    else if (type === "heal") this.tone(420, 0.35, 0.05, "sine", 520);
    else if (type === "overload") this.tone(220, 0.3, 0.05, "sawtooth", 620);
    else if (type === "starfall") this.tone(880, 0.65, 0.07, "triangle", -650);
    else if (type === "gameOver") this.tone(180, 0.9, 0.08, "sine", -105);
  }
}
