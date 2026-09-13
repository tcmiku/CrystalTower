import { GAME_CONFIG } from './config.js';
import { getTechStatus, getTowerStats } from './engine.js';
import { slotCountForTier } from './modules.js';

// Preview the same stats used by combat without mutating the live run.
export function coreUpgradePresentation(state, key) {
  const status = getTechStatus(state, key);
  const level = state.tower.upgrades[key];
  const maxLevel = GAME_CONFIG.techTree[key].maxLevel;
  const current = getTowerStats(state);
  const next = getTowerStats({ ...state, tower: { ...state.tower, upgrades: { ...state.tower.upgrades, [key]: Math.min(level + 1, maxLevel) } } });
  const format = value => Number(value.toFixed(1)).toString();
  let effect;
  if (key === 'damage') effect = `晶塔伤害 ${format(current.damage)} → ${format(next.damage)}`;
  if (key === 'rate') effect = `每秒射击 ${format(current.fireRate)} → ${format(next.fireRate)} 次`;
  if (key === 'ascend') {
    const slots = slotCountForTier(level), nextSlots = slotCountForTier(Math.min(level + 1, maxLevel));
    effect = `${slots!==nextSlots?`装配容量 ${slots} → ${nextSlots} 格 · `:''}生命 +${next.maxHp-current.maxHp} · 射程 ${format(current.range)} → ${format(next.range)} · 伤害 ${format(current.damage)} → ${format(next.damage)} · 射速 ${format(current.fireRate)} → ${format(next.fireRate)}`;
  }
  const affordable = state.coins >= status.cost;
  const ready = status.unlocked && !status.maxed && affordable && !state.over;
  const reason = status.maxed ? '已达到最高等级' : state.over ? '本局已结束' : !status.unlocked ? status.reason.replace('淬亮晶矢', '伤害').replace('加速咏唱', '射速') : !affordable ? `还差 ${Math.ceil(status.cost - state.coins)} 金币` : '立即升级';
  return { ...status, level, maxLevel, ready, reason, effect: status.maxed ? '本项强化已全部完成' : effect };
}
