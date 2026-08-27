import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("页面包含运行所需控件且不加载外部资产", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const requiredIds = [
    "gameCanvas", "healthText", "coinsText", "threatText", "timeText", "upgradeList", "skillList",
    "techTreePanel", "openTechTreeButton", "closeTechTreeButton", "techCoinsText", "techPanelThreatText", "globalLeaderboardPodium",
    "droneModeButton", "droneModeText", "droneModeHint", "droneProtocolButton", "droneProtocolText", "droneProtocolHint", "droneEnergyFill",
    "pauseButton", "muteButton", "speedButton", "openUpdatesButton", "updatesModal", "closeUpdatesButton", "updatesDismissButton", "updatesList", "updatesSyncStatus", "updatesCurrentVersion", "updatesCurrentDate",
    "accountButton", "accountModal", "closeAccountButton", "loginForm", "showRegisterButton", "registerForm", "showLoginButton", "accountUserPanel", "saveChoicePanel", "useCloudSaveButton", "useLocalSaveButton", "logoutButton", "deleteAccountButton",
    "scoreText", "openLeaderboardButton", "leaderboardModal", "closeLeaderboardButton", "globalLeaderboardList", "globalLeaderboardCount", "gameOverModal", "resultScore", "scoreEntryForm", "playerNameInput", "playerMessageInput",
    "submitScoreButton", "leaderboardList", "leaderboardCount", "researchList", "restartButton", "clearSaveButton",
    "loadingScreen", "loadingProgress", "loadingStatus", "loadingPercent",
    "tutorialGuide", "tutorialTitle", "tutorialText", "tutorialChoices", "tutorialDismiss",
    "openBaseCampButton", "baseRecoveryModal", "recoveryContinueButton", "baseCampModal", "closeBaseCampButton", "battleEchoShardText", "battleCoreFragmentText", "baseCampEchoShardText", "baseCampCoreFragmentText", "campaignRoom", "campaignPanel", "chapterNodeList", "chapterCompleteModal", "finishExpeditionButton", "startEndlessButton", "endEndlessButton", "researchBayRoom", "relicResearchPanel", "relicResearchList", "relicResearchEchoText", "relicResearchCoreText", "relicSlotResearch", "openBaseCampFromGameOver"
  ];
  for (const id of requiredIds) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);
  assert.match(html, /src=["']\.\/src\/main\.js["']/);
  assert.match(html, /打开后自动暂停战斗/);
  assert.match(html, /SCORE · RANKING/);
  assert.match(html, /游戏更新公告/);
  assert.match(html, /id="openUpdatesButton"[^>]*>\s*<svg class="top-icon"/);
  assert.match(html, /id="accountButton"[^>]*>\s*<svg class="top-icon"/);
  assert.match(html, /id="muteButton"[^>]*>\s*<svg class="top-icon sound-icon"/);
  assert.match(html, /id="pauseButton"[^>]*>\s*<svg class="top-icon pause-icon"/);
  assert.match(html, /id="registerForm" class="auth-form hidden"/);
  assert.match(html, /没有账号？注册/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /updatesDismissButton/);
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const accountStyles = await readFile(new URL("../auth.css", import.meta.url), "utf8");
  assert.match(accountStyles, /\.account-modal/);
  assert.match(styles, /@media \(max-width: 1024px\)/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /#gameCanvas[^}]*touch-action:\s*none/s);
  assert.match(styles, /text-size-adjust:\s*100%/);
  assert.match(styles, /Browser zoom reduces the CSS viewport/);
  assert.match(styles, /data-upgrade="damage"[\s\S]*#ff707a/);
  assert.match(styles, /#damageStat\s*\{\s*color:\s*#ff707a/);
  assert.match(styles, /status:nth-child\(2\) strong[\s\S]*#ffd36d/);
  assert.match(styles, /\.basecamp-modal[\s\S]*overflow-y:\s*auto/);
  assert.match(styles, /\.basecamp-shell[\s\S]*height:\s*auto[\s\S]*overflow:\s*visible/);
  assert.match(styles, /\.upgrade-panel[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.drone-protocol-button \{ grid-column:\s*1 \/ -1;/);
  assert.match(styles, /\.relic-research-card p[\s\S]*font-size:\s*12px/);
  assert.match(styles, /\.relic-run-chip:hover[\s\S]*\.relic-run-tooltip/);
  assert.match(styles, /\.relic-run-chip[\s\S]*pointer-events:\s*auto/);
  assert.match(styles, /leaderboard-podium[\s\S]*leaderboard-podium-ai\.png/);
  assert.match(styles, /\.base-room\.research-room\.active \{ left:38%; right:auto;/);
  assert.match(styles, /\.status span,[\s\S]*\.leaderboard-list li \{ font-size: 10px; \}/);
  assert.match(styles, /update-warning/);
  assert.match(styles, /\.podium-message/);
  assert.match(styles, /podium-bubble-float/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /score-entry-labels/);
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(main, /pendingStartupFlow/);
  assert.match(main, /updatesDismissed/);
  assert.match(main, /playerMessageInput/);
  assert.match(main, /podium-message/);
  assert.match(main, /leaderboard-messages/);
  assert.match(main, /tower-health/);
  assert.match(main, /现已上线登录功能/);
  assert.match(main, /warning\.className = "update-warning"/);
  const renderer = await readFile(new URL("../src/renderer.js", import.meta.url), "utf8");
  assert.match(main, /战利品已经掉落/);
  assert.match(main, /第一笔金币已到手/);
  assert.match(main, /晶刃 · 近身防御/);
  assert.match(main, /无人机 · 经济自动化/);
  assert.match(main, /路线 A · 疾旋炮刃/);
  assert.match(main, /路线 B · 弹射飞刃/);
  assert.match(main, /协议电池扩容/);
  assert.match(main, /路线 A · 自爆猎杀/);
  assert.match(main, /路线 B · 防御护盾/);
  assert.match(main, /路线 A · 破城炮膛/);
  assert.match(main, /路线 B · 裂晶炮膛/);
  assert.match(main, /蓄能晶矢/);
  assert.match(main, /碎片增殖/);
  assert.match(main, /优先锁定 Boss \/ 精英/);
  assert.match(main, /pointerType === "touch"/);
  assert.match(main, /bossDefeated[\s\S]*unlockDoubleSpeed/);
  assert.match(main, /威胁 Ⅹ · 时流加速解锁/);
  assert.match(main, /accumulator \+= frameDelta \* \(doubleSpeedActive \? 2 : 1\)/);
  assert.match(main, /sovereignSpeedLocked/);
  assert.match(main, /restoreDoubleSpeedAfterSovereign/);
  assert.match(main, /时流锁定 1×/);
  assert.match(main, /steps < 16/);
  assert.match(main, /pointermove[\s\S]*collectCoinAt/);
  assert.match(main, /鼠标滑过/);
  assert.doesNotMatch(main, /addEventListener\("blur",/);
  assert.match(renderer, /怪群 ×/);
  assert.match(renderer, /pileCount/);
  assert.match(renderer, /drawTowerHealthBar/);
  assert.match(main, /renderLeaderboardPodium/);
  assert.match(main, /globalLeaderboardPodium/);
  assert.match(main, /leaderboard-time/);
  assert.match(main, /podium-time/);
  assert.match(main, /collectPermanentResourceAt/);
  assert.match(main, /showBaseRecoveryEvent/);
  assert.match(main, /等级 \$\{level\}\/\$\{GAME_CONFIG\.research\.maxLevel\}/);
  assert.match(main, /createRelicHudChip/);
  assert.match(html, /relicArchiveRoom/);
  assert.match(html, /relicArchivePanel/);
  assert.match(main, /renderRelicArchive/);
  assert.match(main, /relic-lock/);
  assert.match(main, /折光雷晶/);
  assert.match(main, /霜烬共生核/);
  assert.match(main, /棱光替身/);
  assert.match(main, /setAttribute\("aria-label"/);
  assert.match(main, /chip\.title = effect/);
  assert.match(main, /firstFailureCoreGift = firstFailure \? 1 : 0/);
  assert.doesNotMatch(await readFile(new URL("../src/engine.js", import.meta.url), "utf8"), /source: "(?:wave|protocol)"/);
  assert.match(renderer, /resource-echo-shard-ai\.png/);
  assert.match(renderer, /enemy-astral-atlas-ai\.png/);
  assert.match(main, /COLOSSUS_COUNTER_HINTS/);
  assert.match(main, /炮击锚点出现/);
  assert.match(main, /previewMode === "sovereign-entry"/);
  assert.match(main, /previewMode === "sovereign-skills"/);
  assert.match(main, /skill-tooltip/);
  assert.match(styles, /skill-button:hover \.skill-tooltip/);
  assert.match(styles, /--ui-attack:\s*#ff707a/);
  assert.equal((main.match(/previewMode === "relics"/g) ?? []).length, 1);
  assert.ok(main.indexOf("let relicChoiceOpen = false") < main.indexOf('previewMode === "relics"'));
  assert.match(renderer, /可摧毁裂隙/);
  assert.match(renderer, /弱点暴露/);
  assert.match(styles, /basecamp-core-room-ai\.png/);
});

test("设计、构建与入口产物齐全", async () => {
  const paths = [
    "design/GAME_DESIGN.md", "design/ART_DIRECTION.md", "build/BUILD_BRIEF.md", "qa/ASSET_QA.md", "qa/TECH_TREE_QA.md",
    "index.html", "styles.css", "src/main.js", "src/engine.js", "src/github-updates.js",
    "assets/generated/arena-bg.png", "assets/generated/loading-splash.png", "assets/generated/tower-atlas.png",
    "assets/generated/enemy-atlas.png", "assets/generated/crystal-saw.png",
    "assets/generated/arena-day.png", "assets/generated/enemy-wave-atlas.png",
    "assets/generated/enemy-astral-atlas-ai.png",
    "assets/generated/boss-overlord.png", "assets/generated/boss-void-ring-colossus.png",
    "assets/generated/boss-rift-sovereign-ai.png",
    "assets/generated/boss-corruption-lance-ai.png",
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
    "assets/generated/relic-decoy-ai.png", "assets/generated/relic-lunar-ai.png", "assets/generated/relic-mirror-ai.png", "assets/generated/relic-ember-ai.png", "assets/generated/relic-boost-ai.png", "assets/generated/relic-endless-amplifier-ai.png",
    "assets/generated/leaderboard-podium-ai.png",
    "assets/generated/resource-echo-shard-ai.png", "assets/generated/resource-core-fragment-ai.png", "assets/generated/basecamp-core-room-ai.png", "assets/generated/campaign-core-nexus-ai.png",
    "assets/generated/ASSET_MANIFEST.md", "assets/generated/PROMPTS.md"
  ];
  await Promise.all(paths.map((path) => access(new URL(`../${path}`, import.meta.url))));
  assert.ok(root.endsWith("eternal-crystal-tower\\") || root.endsWith("eternal-crystal-tower/"));
});
