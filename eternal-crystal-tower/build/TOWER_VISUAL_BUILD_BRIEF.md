# 《永耀晶塔》晶塔视觉演化实施方案

## 成品目标

在不改变战斗规则、数值、操作和碰撞体的前提下，让中央晶塔成为每局持续变化的第一视觉焦点。玩家不看 UI，也能从塔身判断：

1. 当前塔阶；
2. 已选择的炮膛路线；
3. 当前受损程度；
4. 正在释放的主动技能；
5. 已安装的冰、火、雷元素模块。

目标平台保持现有横屏网页游戏，首发界面语言保持简体中文。

## 必读设计

- `design/GAME_DESIGN.md`
- `design/ART_DIRECTION.md`
- `src/engine.js` 中的塔阶、科技、生命、护盾和技能状态
- `src/renderer.js` 中的 `drawTower()`、`drawElementModules()` 与技能特效

## 必须保真

- 晶塔始终处于战场中央，是画面第一焦点。
- 保留“晶芽 → 晶柱 → 晶冠 → 万象晶塔”四个塔阶。
- 破城炮膛与裂晶炮膛维持互斥，结构变化必须反映真实研究结果。
- 冰、火、雷模块继续占据不同轮廓区；万象晶塔使用融合塔身，不再叠加旧外挂。
- `Q` 晶愈、`W` 超载、`E` 星落、`F` 金潮归塔的玩法、冷却与输入不变。
- 不改变塔的中心坐标、碰撞半径、射程、攻击结算或敌人寻路。
- 所有新效果首先传达状态，其次才提供装饰性气氛。

## 当前基线与问题

当前已有：

- `tower-atlas.png` 的三个基础塔阶与 `tower-ultimate-ai.png` 的终极塔阶；
- 塔阶环、护盾、无人机防御环、超载轨道、低生命裂纹；
- 霜棱炮口、烬火炉心、雷鸣天球三个独立模块；
- 升阶、受击、护盾爆发、星落、金币回收等事件特效；
- `tower-health`、`skills`、`elements`、`ultimate` 等预览入口。

主要缺口：

- 常态成长主要依赖换图和加光环，科技路线没有持续改变塔身结构；
- 受损只有低生命裂纹，缺少由完整到濒毁的连续变化；
- 主动技能多为塔外特效，塔身没有明显的展开、闭合、对准或充能动作；
- 升级影响范围局限于塔身附近，战场中央阵地没有同步成长。

## 范围

### 第一轮必须包含

- 统一的晶塔视觉状态派生函数；
- 四档生命状态；
- 破城/裂晶两条炮膛路线的永久轮廓差异；
- 超载三段热量结构变化；
- 晶愈、星落、金潮归塔的塔身动作；
- 随塔阶和路线成长的地面晶脉；
- 可通过 URL 稳定复现的视觉预览矩阵；
- 自动测试与真实浏览器截图验证。

### 明确排除

- 不改第二章航母外观；
- 不增加新技能、新科技、新货币或新升级界面；
- 不重画背景、敌人、首领与 UI；
- 不修改战斗数值、技能冷却与升级价格；
- 不在首轮生成四塔阶乘以全部模块组合的大量整图资产；
- 不用全屏粒子、持续闪白或高强度辉光代替结构变化。

## 视觉状态契约

新增一个纯派生函数 `getTowerVisualState(state)`，建议放在 `src/renderer.js` 并导出供测试使用。它只读取现有状态，不反写游戏状态。

建议返回：

```js
{
  tier: 0 | 1 | 2 | 3,
  hpRatio: number,
  damageBand: "intact" | "damaged" | "critical" | "collapse",
  cannonRoute: "none" | "siege" | "split",
  elements: { frost: boolean, fire: boolean, lightning: boolean },
  ultimate: boolean,
  overloadBand: "off" | "charged" | "hot" | "overheated",
  starfallBand: "off" | "aiming" | "release",
  shieldBand: "none" | "partial" | "full" | "armed"
}
```

### 状态映射

| 可视状态 | 数据来源 | 规则 |
|---|---|---|
| 塔阶 | `state.tower.upgrades.ascend` | 0–3 直接映射 |
| 完整 | `hp / maxHp` | `>= 0.70` |
| 受损 | `hp / maxHp` | `>= 0.40 && < 0.70` |
| 危急 | `hp / maxHp` | `>= 0.15 && < 0.40` |
| 濒毁 | `hp / maxHp` | `< 0.15` |
| 破城路线 | `cannonSiege > 0` | 两侧棱镜炮臂 |
| 裂晶路线 | `cannonSplit > 0` | 顶部多瓣发射晶冠 |
| 超载充能 | `heat / threshold` | `< 0.50`，紫色核心与轻微展开 |
| 超载高热 | `heat / threshold` | `0.50–0.99`，外壳进一步展开并转暖橙 |
| 超载过热 | `heat / threshold` | `>= 1`，核心橙白、结构抖动、排热 |
| 星落瞄准 | `starfall.aiming` | 晶冠朝瞄准角旋转并建立光轴 |
| 星落释放 | `starfall.active > 0` | 晶冠完全张开，释放后短暂熄灭 |
| 护盾反击就绪 | `shieldBurstArmed` | 六片棱镜甲完全闭合，顶部白晶花点亮 |

万象晶塔 `tier === 3` 时 `ultimate = true`，不绘制三个旧元素外挂；元素只通过融合塔身的霜纹、炉心和雷环表达。

## 同时状态的表现优先级

状态允许共存，但不能互相覆盖到无法识别。

### 几何优先级

1. 升阶组装；
2. 超载外壳展开；
3. 星落晶冠对准；
4. 炮膛路线结构；
5. 生命缺损；
6. 元素外挂。

### 色光优先级

1. 濒毁能量泄漏；
2. 超载高热/过热；
3. 技能瞄准与释放；
4. 元素功能色；
5. 常态青白呼吸光。

护盾、金币回流与地面晶脉作为独立前后景层保留，不抢占塔身主轮廓。

## 渲染分层

将当前 `drawTower()` 拆成可独立验证的视觉层，保持调用顺序固定：

```text
drawTowerGroundVeins       地面晶脉、路线图案、生命熄灭
drawTowerRearFx            后景护盾、超载轨道、技能光轴
drawTowerBase              四塔阶基础图或灰盒回退
drawTowerRouteModules      破城炮臂、裂晶晶冠
drawElementModules         现有冰、火、雷外挂
drawTowerDamage            裂纹、缺损、碎片、能量泄漏
drawTowerSkillMechanics    展开外壳、闭合晶甲、星落对准、金潮充能
drawTowerForegroundFx      前景护盾、闪光、组装碎片
drawTowerHealthBar         现有临时生命条
```

分层重构完成后，第一张基线截图必须与改造前保持可接受的一致，再开始增加新视觉。

## 资产策略

### 首轮复用

- 继续使用 `tower-atlas.png` 与 `tower-ultimate-ai.png`；
- 继续使用三个现有元素模块；
- 炮膛结构、晶冠花瓣、地面晶脉、裂纹和排热孔先用 Canvas 路径实现；
- 静态路径缓存，禁止在每帧创建离屏画布、图片或大数组。

### 视觉验证后再替换

只有灰盒轮廓通过截图验收后，才考虑补充：

- `tower-route-siege-ai.png`：左右分离的透明炮臂覆盖层；
- `tower-route-split-ai.png`：顶部多瓣晶冠透明覆盖层；
- `tower-shell-panels-ai.png`：超载展开外壳覆盖层。

新资产必须使用同一机位、同一银金骨架、同一靛紫阴影，提供真实 alpha；不得在图片中烘焙文字、辉光背景或地面。

## 分阶段实施

### 阶段 0：建立可测试的渲染骨架

任务：

- `TV-001`：增加并导出 `getTowerVisualState(state)`；
- `TV-002`：把 `drawTower()` 按渲染分层拆分，暂不改变最终画面；
- `TV-003`：为静态塔阶和路线结构准备可复用路径/缓存；
- `TV-004`：增加统一预览入口：
  - `?preview=tower-visual&tier=0&hp=1`
  - `?preview=tower-visual&tier=2&hp=.25&route=siege`
  - `?preview=tower-visual&tier=2&skill=overload&heat=80`
  - `?preview=tower-visual&tier=3&skill=starfall`
- `TV-005`：为状态边界、路线互斥和终极塔隐藏外挂增加单元测试。

完成证据：

- 原有 `npm test` 全部通过；
- 新状态函数边界测试通过；
- 默认开局、`elements`、`ultimate`、`tower-health`、`skills` 预览无视觉回归；
- 浏览器控制台无错误和资源 404。

### 阶段 1：受损、恢复与地面晶脉

任务：

- `TV-101`：增加四档生命外观；
- `TV-102`：受损时依次关闭副晶体、降低晶环稳定性、增加脱落碎片；
- `TV-103`：濒毁时让晶脉由外向内熄灭，核心间歇闪烁；
- `TV-104`：晶愈触发时播放碎片归位和裂纹闭合，护盾充满时六片晶甲闭合；
- `TV-105`：地面晶脉随塔阶扩展，最大范围不超过当前战斗视口短边的 32%；
- `TV-106`：受损效果不得修改塔中心、半径和敌人接触判定。

完成证据：

- 静态截图可区分 100%、55%、25%、10% 四档生命；
- `Q` 前后录屏中能看到明确的“缺损 → 重组”过程；
- 护盾开启时受损状态仍然可读；
- 不看生命条也能分辨危急与濒毁。

### 阶段 2：超载与技能塔身动作

任务：

- `TV-201`：超载开始时四片外壳展开，展开量由热量连续驱动；
- `TV-202`：高热阶段打开排热孔并加入短火星，过热阶段只让外挂结构抖动，不抖动整个镜头中的塔坐标；
- `TV-203`：超载结束时外壳回落，提前释放和过热释放沿用现有强度差异；
- `TV-204`：星落瞄准时顶部晶冠朝 `aimAngle` 偏转，建立塔心—晶冠—扇区的光轴；
- `TV-205`：星落释放后晶冠短暂熄灭并从下向上复燃；
- `TV-206`：金潮归塔时地面晶脉由外向内变金，塔身能量槽自下向上填充；
- `TV-207`：技能取消、冷却和无可用目标时不残留结构状态。

完成证据：

- 暂停截图能区分超载低热、高热和过热；
- 星落仅凭晶冠朝向即可看出瞄准方向；
- 金潮结束后所有金色临时状态按时清除；
- 四个技能连续触发后没有状态串色或残留。

### 阶段 3：炮膛路线永久结构

任务：

- `TV-301`：研究破城炮膛后增加左右棱镜炮臂；
- `TV-302`：蓄能等级改变炮臂后缩距离，贯星终点将炮口改为十字晶孔；
- `TV-303`：研究裂晶炮膛后增加顶部多瓣发射晶冠；
- `TV-304`：碎片增殖增加可见花瓣，回响触发时依次点亮，级联触发时晶冠整圈旋转；
- `TV-305`：元素模块继续占用左肩、右侧、塔顶三个既定区域，不遮挡炮膛路线主轮廓；
- `TV-306`：升级成功时播放 0.7–1.0 秒部件组装，不暂停战斗；
- `TV-307`：破城地面晶脉形成前向锐角，裂晶地面晶脉形成分叉网格。

完成证据：

- 无 UI、无弹道的静态截图仍能区分破城与裂晶；
- 终点升级相较路线初阶有第二次明显结构变化；
- 同时安装三个元素模块后，炮膛路线仍可识别；
- 万象晶塔不叠加旧外挂，但保留已选路线的轻量纹章提示。

### 阶段 4：资产替换与最终打磨

任务：

- `TV-401`：对照截图决定哪些 Canvas 灰盒需要替换为透明生图覆盖层；
- `TV-402`：验证所有新增资产透明像素 `alpha = 0`，缩放后无白边；
- `TV-403`：限制同时存在的高亮环和阴影模糊，保证敌人接近塔下时仍可读；
- `TV-404`：统一升阶、技能、受损和恢复声音节奏，不新增长语音；
- `TV-405`：在正常局、后期怪潮和首领战中完成最终截图复核。

完成证据：

- 缩略到战斗区域宽度 25% 时，四塔阶和两路线仍可辨认；
- 敌人围塔时晶塔主轮廓不被特效完全遮住；
- `preview=performance` 下平均帧时间相较基线不恶化超过 10%；
- 新增资产不存在白底、彩边和加载失败。

## 文件修改范围

| 文件 | 允许修改 |
|---|---|
| `src/renderer.js` | 状态派生、分层绘制、路径缓存、技能结构动画 |
| `src/main.js` | 视觉预览参数与升级后组装事件，不增加玩法状态 |
| `tests/renderer.test.js` | 视觉状态纯函数和边界测试 |
| `assets/generated/` | 阶段 4 经批准后的透明覆盖层 |
| `design/ART_DIRECTION.md` | 仅在最终视觉规则发生批准后的调整时同步 |

原则上不修改 `src/engine.js`、`src/config.js` 和存档结构。若某个视觉过程需要短时计时器，优先放在 `Renderer` 实例中，通过现有 `trigger()` 事件启动；不要把纯表现计时写进游戏状态。

## 自动测试清单

- `hpRatio = 0.70` 为 `intact`；低于 0.70 进入 `damaged`；
- `hpRatio = 0.40` 为 `damaged`；低于 0.40 进入 `critical`；
- `hpRatio = 0.15` 为 `critical`；低于 0.15 进入 `collapse`；
- 破城与裂晶不同时返回；
- `tier === 3` 时 `ultimate === true` 且旧元素外挂不绘制；
- 超载热量在 0.50 和 1.00 的边界正确切换；
- 星落取消后立即返回 `off`；
- 满盾反击正确返回 `armed`；
- 原有战斗、技能、科技、存档和第二章测试全部通过。

## 浏览器验收矩阵

固定 `seed=42`，至少截取以下状态：

| 截图 | 塔阶 | 路线 | 生命 | 技能 |
|---|---:|---|---:|---|
| A | 0 | 无 | 100% | 无 |
| B | 1 | 无 | 55% | 晶愈恢复 |
| C | 2 | 破城 | 25% | 超载高热 |
| D | 2 | 裂晶 | 100% | 星落瞄准 |
| E | 3 | 破城纹章 | 100% | 金潮归塔 |
| F | 3 | 裂晶纹章 | 10% | 过热结束 |

视口至少覆盖：

- `2048 × 956`：当前桌面战斗视口基线；
- `1366 × 768`：常见紧凑横屏；
- 右侧面板展开与收起两种布局。

每张截图检查：中央焦点、塔阶、路线、生命状态、技能状态、敌我遮挡和 UI 重叠。

## 性能与可读性约束

- 禁止在渲染循环中加载图片、创建新离屏画布或逐帧重建不变路径；
- 静态晶脉、裂纹和结构路径按塔阶/路线缓存；
- 大面积 `shadowBlur` 只在重大技能的短时间窗口出现；
- 同时旋转的塔外圆环最多三层；
- 任何单次技能都不能让塔身完全白化超过一个画面闪帧；
- 受损红色不能覆盖冰、火、雷的功能识别色；
- 新增动画遵循减少动态效果设置时，降低抖动、碎片与频闪强度。

## 实施顺序与交付边界

推荐先交付一个最小可验证切片：

```text
阶段 0 渲染骨架
→ 阶段 1 四档受损 + 晶愈恢复
→ 阶段 2 超载三段展开
```

这一切片已经能验证“晶塔是否像一个会受伤、恢复和过热的活体战争设施”。验证通过后再投入两条炮膛路线和新覆盖层资产，避免在未证明轮廓方案前批量生图。

## 完成定义

全部满足才算完成：

- 不看 UI 能识别塔阶、路线、生命档位和主要技能状态；
- 升级、受击、恢复、瞄准、释放的反馈在同一拍闭合；
- 不改变任何玩法结算、碰撞、输入与存档；
- 自动测试全部通过；
- 真实浏览器无控制台错误和资源缺失；
- 目标视口截图通过人工复核；
- 文档补充实际运行命令、已执行验证与仍存在的视觉限制。

## 生图模型生产流程（强制）

### 生产边界

生图模型负责“静态、可替换、需要美术辨识度”的内容：塔身、炮臂、晶冠、外壳、护盾棱镜和元素覆盖层。Canvas 负责“实时、连续、由状态驱动”的内容：旋转、闪烁、热量进度、裂纹强度、金币流向、星落光轴和碎片运动。

这样既能保证生图资产有统一美术质量，也不会为每一个生命值或技能帧生成图片。

### 生产顺序

1. **风格锚点**：以现有 `tower-atlas.png`、`tower-ultimate-ai.png` 和三个元素模块作为参考，先生成一张只用于对照的 `design/tower-style-anchor-v1.png`。它不直接进入游戏，只锁定机位、比例、材质和颜色。
2. **基础塔身复核**：若现有基础塔阶截图仍无法在缩略图中区分，再整体重生成四塔阶；四个塔阶必须一次锁定同一提示词锚点，不分批改变风格。
3. **结构覆盖层**：依次生成破城炮臂、裂晶晶冠、超载外壳、护盾棱镜四类透明覆盖层。每张图只包含一种结构，不包含完整塔身、背景、地面或文字。
4. **元素覆盖层**：现有冰、火、雷模块先复用；只有遮挡路线轮廓或比例不一致时才重新生成。
5. **游戏内替换**：灰盒和 Canvas 路径通过截图验收后，一次只替换一类资产，并更新 `renderer.js`、`assets/generated/ASSET_MANIFEST.md` 和 `assets/generated/PROMPTS.md`。

### 固定风格锚点

以下文字必须逐字出现在每一条晶塔资产提示词中，不得在不同资产之间改写：

```text
Original visual language for 永耀晶塔: dark indigo crystal wasteland, silver-gold structural frame, cyan-white guardian light, restrained violet shadows, functional light and material states, strong readable silhouette at small size, centered game asset, no UI, no text, no watermark.
```

### 生图提示词模板

每次调用内置生图模型使用以下结构。默认使用 built-in `image_gen`，请求真实透明背景；不使用 CLI fallback，除非用户单独确认 CLI/API 路径。

```text
Use case: stylized-concept
Asset type: transparent game asset overlay for Eternal Crystal Tower
Primary request: <one structure only>
Input images: Image 1: existing tower asset as style and proportion reference; Image 2: existing element module reference (optional)
Scene/backdrop: none, genuinely transparent background
Subject: <centered structure with clear outer silhouette>
Style/medium: polished stylized game asset, silver-gold crystal architecture, sharp faceted surfaces
Composition/framing: orthographic front three-quarter game view, same center and scale as the existing tower, generous transparent padding
Lighting/mood: cyan-white rim light with restrained violet shadow, functional state color only where specified
Color palette: dark indigo, silver, warm gold, cyan-white, restrained violet
Materials/textures: faceted crystal, brushed metal frame, emissive core, clean game-readable edges
Constraints: genuinely transparent background; preserve the reference camera, proportions and visual language; no full environment; no ground; no UI; no Chinese or English text; no logos; no watermark
Avoid: photorealism, soft blob shapes, rainbow colors, excessive bloom, detached decorative objects, extra weapons, extra characters
```

### 首批资产提示词内容

在模板的 `Primary request` 中只替换以下一行，其他锚点保持不变：

| 文件名 | Primary request |
|---|---|
| `tower-route-siege-ai-v1.png` | `two symmetrical side-mounted prism cannon arms for the siege cannon route, heavy and angular, muzzle facing outward, no tower body` |
| `tower-route-split-ai-v1.png` | `a six-petal split crystal crown emitter for the split crystal cannon route, petals arranged around an empty center, no tower body` |
| `tower-shell-panels-ai-v1.png` | `four hinged crystal shell panels opening outward around an empty center, designed as an overload heat-stage overlay, no tower body` |
| `tower-shield-prisms-ai-v1.png` | `six separated defensive prism plates forming a partial ring, transparent gaps between plates, no tower body` |
| `tower-ultimate-insignia-ai-v1.png` | `a small integrated route insignia for the ultimate tower, compatible with both siege and split routes, no old elemental attachments` |

### 生图筛选标准

每类资产先生成多个候选，只保留满足全部条件的一张：

- 缩略图下外轮廓仍清晰；
- 与现有塔身中心、比例和视角一致；
- 透明区域真实存在，边缘没有白色或彩色光晕；
- 单独叠加时不遮挡塔阶主轮廓；
- 不出现额外塔、炮口、人物、符号、文字或背景；
- 与现有冰、火、雷模块并置时不变成彩虹色；
- 关闭 `shadowBlur` 后仍然能看出结构。

### 资产验收与入库

1. 用 `view_image` 检查主体、构图和边缘；
2. 用脚本读取 PNG alpha 通道，确认透明像素存在且不被纯白底拍平；
3. 在 `tower-visual` 预览矩阵中叠加检查，不直接覆盖旧资产；
4. 通过截图验收后，将版本化文件移动到 `assets/generated/`；
5. 在 `ASSET_MANIFEST.md` 登记用途、尺寸、是否透明和回退资产；
6. 在 `PROMPTS.md` 保存最终提示词和参考图角色；
7. 任何资产失败时回退到 Canvas 灰盒，不阻塞游戏运行。

### 参考图角色与版权边界

- 项目现有塔图：只作为本项目的比例、机位和视觉连续性参考；
- `ART_DIRECTION.md`：作为原创风格约束；
- 同类型商业游戏：只借鉴“状态可读、轮廓分级、构筑反馈”等交互原则，不输入其角色、地图、UI 或资产；
- 生图提示词不包含现有商业游戏名称、角色名、品牌名或受保护的具体资产描述。
## 第一阶段执行记录（2026-09-02）

已完成：
- 新增 `getTowerVisualState()`，把晶塔视觉拆成四档生命受损、两条炮膛路线、三段超载热区、星落瞄准/释放、晶愈护盾待命等可测试状态。
- 新增 Canvas 程序化层：地面晶脉、路线色环、裂纹/剥落/核心泄漏、护壳展开、星落方向轴、护盾棱片、治疗环和金币回收脉冲；保留资源缺失时的几何 fallback。
- 接入生图透明覆盖层：破城炮膛、裂晶炮膛、超载护壳；静态资源进入 `assets/generated/` 并完成清单与提示词登记。
- 新增可复现入口：`?preview=tower-visual&tier=0..3&hp=0..1&route=siege|split&skill=overload|starfall|heal`，超载可追加 `heat=0..100`，星落可追加 `angle`。
- 真实页面验收：新资源网络请求均返回 200，关键预览无控制台错误。
- 自动化验收：`npm test` 205/205 通过；新增晶塔视觉状态单元测试 2 项。

下一阶段：补齐护盾棱片和终极徽记的生图覆盖层，并以同一 `tower-visual` 预览矩阵逐张替换验收；连续动画继续由 Canvas 驱动，不为每个数值帧生成图片。
## 瞄准与素材动效补充（2026-09-02）

- `getTowerAimTarget(state)` 复用引擎优先目标队列；目标失效后按射程内距离回退，不改变伤害计算和目标协议。
- 渲染器每帧以阻尼角度追踪目标，主炮显示实体炮管、追踪虚线和敌方准星；`shoot` 事件触发 0.28 秒炮口闪光、后坐力和准星脉冲。
- 生图炮膛覆盖层加入低幅呼吸缩放、破城炮臂微摆、裂晶冠持续缓转；连续运动由 Canvas 驱动，静态 PNG 只承担结构与材质。
- `tower-visual` 预览自动生成一只静止演示敌人并写入优先目标，便于验收瞄准方向；正式战斗不生成该演示目标。
- 真实页面验收：连续两次 Canvas 帧数据不同，证明动画循环正在运行；控制台错误数为 0。
## 主炮美术替换修正（2026-09-02）

根据验收反馈，主炮炮口不再使用 Canvas 几何绘制。新增 `tower-main-cannon-aim-ai-v1.png` 透明美术素材，炮口朝右作为运行时旋转基准；Canvas 仅控制旋转、透明度、呼吸缩放、后坐力和目标追踪线，缺少该资源时只保留追踪线与准星，不绘制替代炮口。