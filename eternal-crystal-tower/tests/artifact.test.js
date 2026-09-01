import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("页面包含运行所需控件且不加载外部资产", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const requiredIds = [
    "gameCanvas", "healthText", "coinsText", "threatText", "timeText", "upgradeList", "skillBar", "skillBarToggle", "skillList",
    "techTreePanel", "openTechTreeButton", "adminConsoleLaunchButton", "closeTechTreeButton", "techCoinsText", "techPanelThreatText", "globalLeaderboardPodium",
    "droneModeButton", "droneModeText", "droneModeHint", "droneProtocolButton", "droneProtocolText", "droneProtocolHint", "droneEnergyFill",
    "pauseButton", "muteButton", "speedButton", "openUpdatesButton", "updatesModal", "closeUpdatesButton", "updatesDismissButton", "updatesList", "updatesSyncStatus", "updatesCurrentVersion", "updatesCurrentDate",
    "accountButton", "accountModal", "closeAccountButton", "loginForm", "showRegisterButton", "registerForm", "showLoginButton", "accountUserPanel", "saveChoicePanel", "useCloudSaveButton", "useLocalSaveButton", "logoutButton", "deleteAccountButton", "deleteLocalSaveButton",
    "scoreText", "openLeaderboardButton", "leaderboardModal", "closeLeaderboardButton", "globalLeaderboardList", "globalLeaderboardCount", "gameOverModal", "resultScore", "scoreEntryForm", "playerNameInput", "playerMessageInput",
    "submitScoreButton", "leaderboardList", "leaderboardCount", "researchList", "restartButton", "clearSaveButton",
    "adminCheatBadge", "adminConsoleModal", "adminConsoleForm", "closeAdminConsoleButton", "adminTowerHpInput", "adminCoinsInput", "adminThreatInput", "adminWaveInput", "adminNextWaveInput", "adminDamageInput", "adminFireRateInput", "adminInvincibleInput", "adminShopInput", "adminDoubleSpeedInput", "adminHealCdInput", "adminOverloadCdInput", "adminStarfallCdInput", "adminCoinVacuumCdInput", "adminRelicList", "adminConsoleStatus",
    "loadingScreen", "loadingProgress", "loadingStatus", "loadingPercent",
    "storyIntro", "storyIntroStage", "storyIntroBackdrop", "storyIntroLayers", "storyIntroBubbles", "storyIntroChapter", "storyIntroProgress", "storyIntroTimeline", "storyIntroDisable", "storyIntroSkip", "storyIntroNext",
    "tutorialGuide", "tutorialTitle", "tutorialText", "tutorialChoices", "tutorialDismiss",
    "openBaseCampButton", "baseRecoveryModal", "recoveryContinueButton", "baseCampModal", "baseCampShell", "closeBaseCampButton", "battleEchoShardText", "battleCoreFragmentText", "baseCampEchoShardText", "baseCampCoreFragmentText", "baseCampModuleList", "baseCampModulePage", "closeBaseCampModuleButton", "baseCampModulePageTitle", "baseCampModulePageStatus", "campaignPanel", "chapterNodeList", "chapterCompleteModal", "finishExpeditionButton", "startEndlessButton", "endEndlessButton", "relicResearchPanel", "relicResearchList", "relicResearchEchoText", "relicResearchCoreText", "relicSlotResearch", "openBaseCampFromGameOver"
  ];
  for (const id of requiredIds) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);
  assert.match(html, /src=["']\.\/src\/main\.js["']/);
  assert.match(html, /打开后自动暂停战斗/);
  assert.match(html, /SCORE · RANKING/);
  assert.match(html, /游戏更新公告/);
  assert.match(html, /管理员测试控制台/);
  assert.match(html, /id="adminConsoleLaunchButton"[^>]*admin-console-launch/);
  assert.match(html, /启动裂隙商店/);
  assert.match(html, /启用 2X 倍速/);
  assert.match(html, /遗响碎片、核心残片与星尘不会获得/);
  assert.match(html, /本次记录永久无法进入排行榜/);
  assert.match(html, /id="openUpdatesButton"[^>]*>[\s\S]*?icon-updates/);
  assert.match(html, /<main class="game-shell topbar-collapsed">/);
  assert.match(html, /id="topbar" class="topbar is-collapsed"/);
  assert.match(html, /id="topbarToggle"[^>]*aria-expanded="false"/);
  assert.match(html, /id="accountButton"[^>]*>[\s\S]*?icon-account/);
  assert.match(html, /id="muteButton"[^>]*>[\s\S]*?icon-sound/);
  assert.match(html, /id="pauseButton"[^>]*>[\s\S]*?icon-pause/);
  assert.doesNotMatch(html, /class="top-icon/);
  assert.match(html, /id="registerForm" class="auth-form hidden"/);
  assert.match(html, /没有账号？注册/);
  assert.match(html, /guest-local-save-actions[\s\S]*删除本地存档/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /updatesDismissButton/);
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const accountStyles = await readFile(new URL("../auth.css", import.meta.url), "utf8");
  assert.match(styles, /admin-console-card/);
  assert.match(styles, /admin-cheat-badge/);
  assert.match(styles, /\.admin-console-launch/);
  assert.match(styles, /\.admin-feature-toggle/);
  assert.match(accountStyles, /\.account-modal/);
  assert.match(accountStyles, /\.guest-local-save-actions/);
  assert.match(styles, /@media \(max-width: 1024px\)/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /#gameCanvas[^}]*touch-action:\s*none/s);
  assert.match(styles, /\.skill-bar\.is-collapsed/);
  assert.match(styles, /text-size-adjust:\s*100%/);
  assert.match(styles, /Browser zoom reduces the CSS viewport/);
  assert.match(styles, /data-upgrade="damage"[\s\S]*#ff707a/);
  assert.match(styles, /#damageStat\s*\{\s*color:\s*#ff707a/);
  assert.match(styles, /status:nth-child\(2\) strong[\s\S]*#ffd36d/);
  assert.match(styles, /\.basecamp-modal[\s\S]*overflow-y:\s*auto/);
  assert.match(styles, /Standalone basecamp module pages/);
  assert.match(styles, /\.basecamp-shell\.module-open \{ height:/);
  assert.match(styles, /\.basecamp-module-page-body \{[\s\S]*overflow-y: auto/);
  assert.match(styles, /\.upgrade-panel[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.drone-protocol-button \{ grid-column:\s*1 \/ -1;/);
  assert.match(styles, /\.side-drone-mode\s*\{\s*order:\s*2;/);
  assert.match(styles, /\.drone-protocol-button\s*\{\s*order:\s*3;/);
  assert.match(styles, /\.relic-research-card p[\s\S]*font-size:\s*12px/);
  assert.match(styles, /\.relic-run-chip:hover[\s\S]*\.relic-run-tooltip/);
  assert.match(styles, /\.relic-run-chip[\s\S]*pointer-events:\s*auto/);
  assert.match(styles, /leaderboard-podium[\s\S]*leaderboard-podium-ai\.png/);
  assert.match(styles, /\.basecamp-module-grid \{[\s\S]*grid-template-columns:/);
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
  assert.match(main, /deleteLocalSaveButton/);
  assert.match(main, /setSkillBarCollapsed/);
  assert.match(main, /setSidePanelCollapsed/);
  assert.match(main, /doubleSpeedEnabled/);
  assert.match(main, /awardedStardust/);
  assert.doesNotMatch(main, /SKILL_BAR_COLLAPSE_DELAY/);
  assert.doesNotMatch(main, /SIDE_PANEL_COLLAPSE_DELAY/);
  assert.match(main, /event\.key\.toLowerCase\(\) === "g"\) switchDroneMode\(\)/);
  assert.match(styles, /\.upgrade-panel\.is-collapsed \.side-drone-mode,/);
  assert.match(main, /setTopbarCollapsed/);
  assert.doesNotMatch(main, /TOPBAR_COLLAPSE_DELAY/);
  assert.doesNotMatch(main, /scheduleTopbarCollapse/);
  assert.match(main, /删除此设备上的游客本地存档/);
  assert.match(main, /warning\.className = "update-warning"/);
  const renderer = await readFile(new URL("../src/renderer.js", import.meta.url), "utf8");
  assert.match(renderer, /TOWER_ART_SCALE = 1\.08/);
  assert.match(main, /战利品已经掉落/);
  assert.match(main, /第一笔金币已到手/);
  assert.match(main, /晶刃 · 近身防御/);
  assert.match(main, /无人机 · 经济自动化/);
  assert.match(main, /路线 A · 疾旋炮刃/);
  assert.match(main, /路线 B · 弹射飞刃/);
  assert.match(main, /星环超频/);
  assert.match(main, /巨刃铸型/);
  assert.match(main, /潮汐刃域/);
  assert.match(main, /环刃风暴/);
  assert.match(main, /万刃归巢/);
  assert.match(renderer, /晶痕 ×/);
  assert.match(renderer, /effect\.element === "sawStorm"/);
  assert.match(renderer, /effect\.element === "sawHomecoming"/);
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
  assert.match(renderer, /ctx\.scale\(crowdVisualScale, crowdVisualScale\)/);
  assert.match(renderer, /pileCount/);
  assert.match(renderer, /drawTowerHealthBar/);
  assert.match(renderer, /coinVacuum\.trails[\s\S]*quadraticCurveTo/);
  assert.match(renderer, /coreGlow\.addColorStop/);
  assert.match(renderer, /cannonEcho[\s\S]*Math\.max\(this\.shake, 0\.65\)/);
  assert.match(renderer, /cannonCascade[\s\S]*Math\.max\(this\.shake, 2\.5\)/);
  const cannonEchoTrigger = renderer.match(/if \(type === "cannonEcho"\) \{[^}]+\}/)?.[0] ?? "";
  assert.doesNotMatch(cannonEchoTrigger, /this\.flash\s*=/);
  assert.doesNotMatch(cannonEchoTrigger, /this\.flashColor\s*=/);
  assert.match(main, /renderLeaderboardPodium/);
  assert.match(main, /globalLeaderboardPodium/);
  assert.match(main, /leaderboard-time/);
  assert.match(main, /podium-time/);
  assert.match(main, /collectPermanentResourceAt/);
  assert.match(main, /showBaseRecoveryEvent/);
  assert.match(main, /等级 \$\{level\}\/\$\{GAME_CONFIG\.research\.maxLevel\}/);
  assert.match(main, /createRelicHudChip/);
  assert.match(main, /BASECAMP_MODULES/);
  assert.match(main, /function showBaseCampHub/);
  assert.match(main, /baseCampRoom \? showBaseCampHub\(true\)/);
  assert.match(html, /id="baseCampModulePage"[\s\S]*id="campaignPanel"[\s\S]*id="threatSealPanel"/);
  assert.match(html, /relicArchivePanel/);
  assert.match(html, /所有遗物默认加入战局候选池/);
  assert.match(html, /最多禁用三件已发现遗物/);
  assert.match(main, /renderRelicArchive/);
  assert.match(main, /buyRelicArchiveUpgrade/);
  assert.match(main, /buyRelicUpgrade/);
  assert.match(main, /relicRarityClass/);
  assert.match(main, /RELIC_UPGRADE_TEXT/);
  assert.match(main, /relicDescription\(key, level\)/);
  assert.match(main, /relicEffect\(id, level\)/);
  assert.match(main, /Q \/ W \/ E \/ F 冷却恢复 \+75%/);
  assert.match(main, /relic-research-silhouette/);
  assert.match(main, /获得一次后才会显示卡图与效果/);
  assert.match(main, /在战斗中发现后解锁/);
  assert.match(styles, /\.relic-rarity-common[^}]*border-color/s);
  assert.match(styles, /\.relic-rarity-rare[^}]*#a970ff/s);
  assert.match(styles, /\.relic-rarity-legendary[^}]*#ffd36d/s);
  assert.match(main, /relic-lock/);
  assert.match(main, /折光雷晶/);
  assert.match(main, /霜烬共生核/);
  assert.match(main, /棱光替身/);
  assert.match(main, /setAttribute\("aria-label"/);
  assert.match(main, /chip\.title = effect/);
  assert.match(main, /firstFailureCoreGift = firstFailure \? 1 : 0/);
  assert.doesNotMatch(main, /if \(!state\.endlessMode \|\| !currentRunScore/);
  assert.match(main, /currentRunMode = state\.endlessMode \|\| outcome === "endless" \? "endless" : "standard"/);
  assert.match(main, /scoreEntryForm\.classList\.remove\("hidden"\)/);
  assert.doesNotMatch(main, /仅无尽挑战可登记章节排行榜成绩/);
  assert.doesNotMatch(await readFile(new URL("../src/engine.js", import.meta.url), "utf8"), /source: "(?:wave|protocol)"/);
  assert.match(renderer, /resource-echo-shard-ai\.png/);
  assert.match(renderer, /enemy-astral-atlas-ai\.png/);
  assert.match(renderer, /const overload = state\.skills\.overload\.active > 0 \|\| state\.skills\.overload\.permanentEngaged/);
  assert.match(renderer, /overloadWaveGlow\.addColorStop/);
  assert.match(renderer, /const overloadHeatArc = Math\.min\(1, heatRatio\)/);
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
  assert.match(html, /baseCampModuleList/);
  assert.match(styles, /Image-led basecamp module cards/);
  assert.match(styles, /basecamp-module-art/);
  assert.match(main, /basecamp-module-campaign-v1\.png/);
  assert.match(html, /id="nexusPanel" class="nexus-panel nexus-core-panel"/);
  assert.match(html, /nexus-upgrade-fx/);
  assert.match(styles, /basecamp-nexus-page-v1\.png/);
  assert.match(styles, /@keyframes nexusUpgradeRing/);
  assert.match(html, /nexus-upgrade-arrows/);
  assert.match(styles, /@keyframes nexusUpgradeArrow/);
  assert.match(main, /function playNexusUpgradeFx/);
  assert.match(main, /research-upgraded/);
  assert.match(main, /previewMode === "nexus"/);
  assert.match(html, /id="storyIntro" class="story-intro hidden"/);
  assert.match(html, /id="storyIntroBubbles" class="story-intro-bubbles"/);
  assert.match(main, /const INTRO_SCENES = \[/);
  assert.match(main, /previewMode === "intro"/);
  assert.match(main, /save\.settings\.introDisabled = true/);
  assert.match(main, /function startChapterOne\(\)/);
  assert.match(main, /const shouldPlayOpening = previewMode === "intro" \|\| \(!previewMode && save\.settings\.introDisabled !== true\)/);
  assert.match(main, /if \(shouldPlayOpening\) showStoryIntro\(continueStartup\)/);
  assert.match(styles, /First-entry animated comic prologue/);
  assert.match(styles, /intro-void-transition-v1\.png/);
  assert.match(styles, /Layered speech-bubble animated comic prologue/);
  assert.match(main, /intro-bg-city-dawn-v1\.png/);
  assert.match(main, /storyIntroLayers/);
  assert.match(main, /duration: 2400/);
  assert.match(styles, /Compact framed opening-story viewport/);
  assert.match(html, /class="story-intro-dialog"/);
  assert.match(styles, /Opening story as a true modal dialog/);
  assert.match(main, /layers: \[\], chapter:/);
  assert.match(main, /layer-horde layer-horde-distant/);
  assert.match(styles, /\.layer-guardian-left \{ z-index: 5; \}/);
});

test("设计、构建与入口产物齐全", async () => {
  const paths = [
    "design/GAME_DESIGN.md", "design/ART_DIRECTION.md", "build/BUILD_BRIEF.md", "qa/ASSET_QA.md", "qa/TECH_TREE_QA.md",
    "index.html", "styles.css", "src/main.js", "src/engine.js", "src/github-updates.js",
    "assets/generated/arena-bg.png", "assets/generated/loading-splash.png", "assets/generated/intro-void-transition-v1.png", "assets/generated/tower-atlas.png",
    "assets/story/intro-panel-01-crystal-city.png", "assets/story/intro-panel-02-shattering.png", "assets/story/intro-panel-03-monster-night.png", "assets/story/intro-panel-04-guardian-reaction.png", "assets/story/intro-panel-05-last-tower.png",
    "assets/story/intro-panel-06-chosen-guardian.png", "assets/story/intro-panel-07-guardian-doubt.png", "assets/story/intro-panel-08-resonance.png", "assets/story/intro-panel-09-horde-leader.png", "assets/story/intro-panel-10-elemental-awakening.png",
    "assets/story/intro-bg-city-dawn-v1.png", "assets/story/intro-bg-ruined-wasteland-v1.png", "assets/story/intro-bg-last-bastion-v1.png", "assets/story/intro-bg-horde-night-v1.png",
    "assets/story/intro-layer-crystal-core-v1.png", "assets/story/intro-layer-crystal-shards-v1.png", "assets/story/intro-layer-guardian-v1.png", "assets/story/intro-layer-monster-horde-v1.png", "assets/story/intro-layer-elemental-burst-v1.png", "assets/story/intro-layer-last-tower-v1.png",
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
    "assets/generated/resource-echo-shard-ai.png", "assets/generated/resource-core-fragment-ai.png", "assets/generated/basecamp-core-room-ai.png", "assets/generated/basecamp-nexus-page-v1.png", "assets/generated/basecamp-module-campaign-v1.png", "assets/generated/basecamp-module-nexus-v1.png", "assets/generated/basecamp-module-relics-v1.png", "assets/generated/basecamp-module-archive-v1.png", "assets/generated/basecamp-module-seals-v1.png", "assets/generated/campaign-core-nexus-ai.png",
    "assets/generated/ui-icons-system-ai-v1.png", "assets/generated/ui-icons-system-ai-v2.png", "assets/generated/ui-icons-battle-ai-v1.png", "assets/generated/ui-icons-status-ai-v1.png", "assets/generated/UI_ICON_MANIFEST.md", "assets/generated/research-bay-bg-ai-v1.png", "assets/generated/RESEARCH_BAY_ART.md",
    "assets/generated/ASSET_MANIFEST.md", "assets/generated/PROMPTS.md"
  ];
  await Promise.all(paths.map((path) => access(new URL(`../${path}`, import.meta.url))));
  assert.ok(root.endsWith("eternal-crystal-tower\\") || root.endsWith("eternal-crystal-tower/"));
});
