import test from "node:test";
import assert from "node:assert/strict";
import { AudioSynth } from "../src/audio.js";

test("同一帧的密集命中与击杀音效会被限流", () => {
  const audio = new AudioSynth(false);
  let tones = 0;
  audio.tone = () => { tones += 1; };
  for (let index = 0; index < 100; index += 1) audio.play("hit");
  for (let index = 0; index < 100; index += 1) audio.play("kill");
  assert.equal(tones, 2);
});
