import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("页面包含运行所需控件且不加载外部资产", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const requiredIds = [
    "gameCanvas", "healthText", "coinsText", "threatText", "timeText", "upgradeList", "skillList",
    "techTreePanel", "openTechTreeButton", "closeTechTreeButton", "techCoinsText", "techPanelThreatText",
    "droneModeButton", "droneModeText", "droneModeHint", "droneEnergyFill",
    "pauseButton", "muteButton", "scoreText", "gameOverModal", "resultScore", "scoreEntryForm", "playerNameInput",
    "submitScoreButton", "leaderboardList", "leaderboardCount", "researchList", "restartButton", "clearSaveButton"
  ];
  for (const id of requiredIds) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);
  assert.match(html, /src=["']\.\/src\/main\.js["']/);
  assert.match(html, /打开后自动暂停战斗/);
});

test("设计、构建与入口产物齐全", async () => {
  const paths = [
    "design/GAME_DESIGN.md", "design/ART_DIRECTION.md", "build/BUILD_BRIEF.md", "qa/ASSET_QA.md", "qa/TECH_TREE_QA.md",
    "index.html", "styles.css", "src/main.js", "src/engine.js",
    "assets/generated/arena-bg.png", "assets/generated/tower-atlas.png",
    "assets/generated/enemy-atlas.png", "assets/generated/crystal-saw.png",
    "assets/generated/arena-day.png", "assets/generated/enemy-wave-atlas.png",
    "assets/generated/boss-overlord.png",
    "assets/generated/projectile-frost-ai-v2.png",
    "assets/generated/projectile-fire-ai.png",
    "assets/generated/projectile-lightning-ai-v2.png",
    "assets/generated/module-frost-cannon-ai.png",
    "assets/generated/module-fire-core-ai.png",
    "assets/generated/module-lightning-orb-ai.png",
    "assets/generated/tower-ultimate-ai.png",
    "assets/generated/effect-frost-hex-ai.png",
    "assets/generated/effect-fire-ember-ring-ai.png",
    "assets/generated/effect-lightning-chain-ai.png",
    "assets/generated/ASSET_MANIFEST.md", "assets/generated/PROMPTS.md"
  ];
  await Promise.all(paths.map((path) => access(new URL(`../${path}`, import.meta.url))));
  assert.ok(root.endsWith("eternal-crystal-tower\\") || root.endsWith("eternal-crystal-tower/"));
});
