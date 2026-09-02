# 生成美术资产清单

生成方式：OpenAI 内置生图模型（每类资产单独生成），2026-08-25。

统一风格锚点：`premium top-down fantasy tower-defense game asset, hand-painted 2D with faceted crystal hard edges, restrained painterly texture, deep indigo shadows, cyan-violet guardian light and ember-red corruption, crisp readable silhouettes at small scale, no text, no logo, no watermark, no photorealism.`

## loading-splash.png

用途：1672×941、16:9 全屏启动加载插画。参考夜间战场与万象晶塔素材生成，以居中的元素晶塔、深靛蓝洞窟、紫色晶簇和青紫能量环延续游戏美术语言；画面不含烘焙文字或 UI，标题、状态和真实加载进度由 HTML/CSS 覆盖绘制。

## arena-bg.png

用途：1448×1086 战场底图。提示词要求垂直俯视、4:3、中央 35% 低细节留白、深靛蓝玄武岩地面、外围紫色晶簇与符文、无单位与界面，并使用统一风格锚点。

## tower-atlas.png

用途：2172×724、透明背景、横向三格塔阶段图集。提示词要求三格分别为晶芽、双符文环晶柱、三符文环晶冠；同一视角、等格留白、轮廓逐级扩大、青紫水晶与银金结构、无文字与格线，并使用统一风格锚点。

## enemy-atlas.png

用途：1254×1254、透明背景、2×2 敌人图集。提示词要求圆形爪状幽灵、箭形疾行怪、宽重甲怪、破碎王冠首领；全部朝右、同一俯视角度、暗紫甲壳与熔红裂隙、各格不交叠，并使用统一风格锚点。

## crystal-saw.png

用途：1254×1254、透明背景、单枚环绕晶刃。提示词要求正俯视、旋转对称、八枚银色切割刃、浅金支架、青紫晶核、小尺寸可辨识、无地面与阴影，并使用统一风格锚点。

## 集成约束

- 所有生成资产均为原创项目素材，不依赖外部 URL。
- 原生透明素材经 RGBA 通道检查，alpha 范围为 0–255；两张元素弹的模型输出例外及运行时透明化处理见下方说明。
- 渲染器异步加载图片；加载失败时继续使用原有 Canvas 程序图形。
- 启动界面会等待全部生成素材完成或失败后再进入游戏，并对失败素材沿用程序图形回退。
- 背景额外覆盖深色遮罩，保持弹道、血条和金币反馈的对比度。

## arena-day.png

用途：白昼战场。以夜景底图为编辑目标，只改变光照与色调，保持地形、晶簇、符文和中央留白位置不变；游戏中约 2.4 秒平滑交叉淡化。

## enemy-wave-atlas.png

用途：透明背景横向双格图集。左格为威胁 4 解锁的六足碎晶爬行怪，右格为威胁 6 解锁的宽重晶甲守卫。

## enemy-astral-atlas-ai.png

用途：1254×1254、透明背景、2×2 异星敌群图集，供威胁 6 及以上的新增敌人使用。四格分别为黑墨高速的墨影猎犬、陶瓷环轨远程的环界浮囊、锈蚀黄铜重装的锈炉甲虫，以及白瓷能刃防守的白瓷执刑者。整体采用科幻生物机械美术，避开既有的水晶切面、紫晶甲壳和熔红裂隙，让威胁 6 的敌群在轮廓、材质和配色上与旧敌人明显区分。由 OpenAI 内置生图模型生成，渲染器按 2×2 单元裁切并在素材缺失时回退到 Canvas 图形。

## boss-overlord.png

用途：1254×1254、透明背景的独立大首领素材“晶核霸主”。破碎五角王冠、夸张前肢、外露熔红晶核与长矛尾构成四层强轮廓；独立于普通敌人图集渲染，以更大的战场占位制造威胁 10 首领的压迫感。素材原始朝向为正右，可由渲染器旋转朝向中央晶塔。

## boss-void-ring-colossus.png

用途：1659×948、透明背景的威胁 15 巨型首领“虚环吞星兽”。长条蛇形晶体巨兽以暗靛甲片、熔红裂隙、背部炮晶与三叉信标体现远程炮击和召唤能力；游戏中沿地图外圈轨道旋转，渲染器根据轨道切线调整朝向，并叠加当前互斥技能的专属光环和名称。

## projectile-frost-ai-v2.png / projectile-fire-ai.png / projectile-lightning-ai-v2.png

用途：三张由 OpenAI 内置生图模型生成的元素弹独立素材。冰霜弹采用长棱晶矛与雪花尾粒，火焰弹采用宽体熔核彗弹与锻造环，雷电弹采用球形雷核、破碎轨道环与分叉电弧；三者在轮廓、长宽比、主色、内部结构和尾迹上均与普通细长晶矢区分。

- 火焰弹原生输出 RGBA 透明通道。
- 冰霜与雷电输出误带浅灰棋盘底，渲染器在加载时仅从画面边缘洪泛移除连通的浅灰中性色背景，保留主体内部白色高光与电弧；图片加载失败时仍回退到 Canvas 程序图形。
- 游戏显示尺寸缩减为 58×29、56×32、52×34 个战场单位，仍明显大于普通晶矢，但不会覆盖小型敌人；三类素材均按实际飞行速度方向旋转。

## 元素塔件与命中特效

- `module-frost-cannon-ai.png`：晶塔左肩银金霜棱炮口，使用青蓝切面炮管与后掠冰翼。
- `module-fire-core-ai.png`：晶塔右侧暗红炉心与悬浮橙红焰芯，原生 RGBA。
- `module-lightning-orb-ai.png`：塔顶紫白雷电球、断续符文轨道环与晶体支架，原生 RGBA。
- `effect-frost-hex-ai.png`：冻结期间套住敌人的空心六角冰封环。
- `effect-fire-ember-ring-ai.png`：灼烧期间持续旋转的空心锻铁余烬环。
- `effect-lightning-chain-ai.png`：在连锁目标之间缩放、旋转的横向折线电弧。
- 六张均由 OpenAI 内置生图模型逐件生成，渲染器可独立定位、缩放、脉动与旋转。冰霜炮口和三张特效图在加载时执行边缘连通浅色背景移除；程序化图形仅作为加载失败回退。

## tower-ultimate-ai.png

用途：三元素共鸣完成后的第四塔阶“万象晶塔”。素材为 1086×1448 的单体终极塔，由 OpenAI 内置生图模型参考原三阶塔图集及冰霜、火焰、雷电模块生成。左侧冰霜堡垒、右侧暗红炉心、塔顶紫白雷球与中央三角融合核心均直接生长在同一塔身中。模型输出带浅色棋盘底，运行时通过边缘连通背景移除生成透明切图；进入第四塔阶后渲染器完全停止绘制三件旧外挂模块。

## boss-corruption-lance-ai.png

用途：威胁 XV 虚环吞星兽的陨晶炮击主体。素材由 OpenAI 内置生图模型生成，为朝右的单枚腐晶能量长矛：白紫核心、深紫切面晶壳、绯红刃缘、破碎符文和长彗尾。运行时缩放为约 132×48 战场单位并按速度角旋转；Canvas 另外绘制紫红尾迹与落点预警。

源文件：`C:\Users\0000\.codex\generated_images\01a03309-5076-7283-ba91-198f67b990cc\exec-1daf8a82-913d-4e76-bc65-23cb0c5b88a3.png`。项目内保留副本，不移动或删除原始生成结果。

## leaderboard-podium-ai.png

用途：全服排行榜前三名领奖台装饰，透明宽幅 PNG。中央金白晶冠代表榜一，左侧银蓝晶台代表榜二，右侧铜玫晶台代表榜三；HTML 动态名次卡片叠加在晶台前方。由 OpenAI 内置生图模型生成，无文字、无徽标、无角色。

## 大本营与永久资源（2026-08-26）

- `resource-echo-shard-ai.png`：透明背景的常见“遗响碎片”战场掉落，青蓝/淡紫碎晶簇、断裂记忆符文环；Canvas 显示约 43×43，必须点击收集。源文件：`C:\Users\0000\.codex\generated_images\01a03309-5076-7283-ba91-198f67b990cc\exec-b54982e1-6952-46cc-9436-ea9212336b83.png`。
- `resource-core-fragment-ai.png`：透明背景的稀有“核心残片”，白金心核、紫红晶壳和断裂金属轨道；Canvas 显示约 52×52，与普通资源在尺寸、色彩和轮廓上区分。源文件：`C:\Users\0000\.codex\generated_images\01a03309-5076-7283-ba91-198f67b990cc\exec-de29a087-a951-4d88-943c-8f6519c3eb1c.png`。
- `basecamp-core-room-ai.png`：16:9 地下永耀大本营核心室背景；左侧晶核中枢亮起、右侧研究舱待机、中央恢复光束与远处封闭扩建位构成可继续增加建筑的空间骨架。源文件：`C:\Users\0000\.codex\generated_images\01a03309-5076-7283-ba91-198f67b990cc\exec-7ee70b55-1ee7-4777-9b91-d9e30bfa7ccb.png`。

三张均由 OpenAI 内置生图模型生成，无文字、徽标或外部素材依赖。资源图使用原生透明通道；基地背景由响应式 CSS 裁切，交互标签与研究内容始终由 HTML 叠加。

## 每局临时遗物卡面（2026-08-26）

- `relic-decoy-ai.png`：诡光诱饵；幽蓝诱饵晶核吸引暗影怪群。
- `relic-lunar-ai.png`：月相调律；日月对半的晶体星盘与元素环流。
- `relic-mirror-ai.png`：镜面裂片；镜晶将一枚晶矢折射到第二目标。
- `relic-ember-ai.png`：余烬回收；熔火晶核、余烬地带与正在消散的金币。
- `relic-boost-ai.png`：满槽后的数值强化共用图；金色能量灌注晶塔核心。

五张卡面均由 OpenAI 内置生图模型生成，无文字、边框、徽标或 UI；项目副本缩放为 640×960 PNG。桌面卡片使用上半幅裁切，窄屏使用左侧缩略图，名称、效果与数字键提示仍由 HTML 叠加。

## boss-rift-sovereign-ai.png（2026-08-27）

用途：威胁 20 超巨型首领“裂界魔君”的 1536×1024 RGBA 半身素材。四枚胸腔命核对应四条生命，双侧巨爪与肩后裂隙强化召唤特征；游戏中以 760 战场单位宽度固定在画面上方，并在 3.2 秒登场动画中由上向下升起。由 OpenAI 内置生图模型生成，项目内保留副本；实际预览确认背景与长夜地图融合、血条和战斗提示保持可读。

源文件：`/Users/mac/.codex/generated_images/01a03d1a-2f6b-7781-8c31-f1dd13235c9c/exec-1bdeca5b-c306-4100-a8e9-a21f151ce136.png`。另行尝试的抠图版本出现烘焙棋盘底，未进入项目。

## campaign-core-nexus-ai.png（2026-08-27）

用途：中枢能源修复计划的章节面板和威胁 20 通关抉择界面背景。画面为地下晶体堡垒中的四节点悬浮能源核心，第一节点点亮、其余节点休眠；章节名称、状态、按钮和进度全部由 HTML 叠加。由 OpenAI 内置生图模型生成，无文字、徽标或 UI。

源文件：`/Users/mac/.codex/generated_images/01a0427f-2259-7320-9dc4-d6759dc567aa/exec-3d888345-f901-40d5-a17b-90447a3fcecf.png`，项目内副本为 `assets/generated/campaign-core-nexus-ai.png`。

## relic-endless-amplifier-ai.png（2026-08-27）

用途：无尽模式专属遗物“无界增幅核”的竖版卡面。青紫晶体能源核与向无限远点重复延伸的金白增幅轨道，表达每波叠加攻击力与攻击速度；名称、层数与数值全部由 HTML 叠加。由 OpenAI 内置生图模型生成，无文字、徽标、边框或 UI。

源文件：`/Users/mac/.codex/generated_images/01a0427f-2259-7320-9dc4-d6759dc567aa/exec-8fb6f2da-0f73-4c21-b828-4f5ddac2a096.png`，项目内副本为 `assets/generated/relic-endless-amplifier-ai.png`。

## 大本营模块入口卡插画（2026-08-28）

- basecamp-module-campaign-v1.png：远征入口，金色罗盘与星门。
- basecamp-module-nexus-v1.png：晶核研究，青紫晶核与同心能量环。
- basecamp-module-relics-v1.png：遗物研究，紫色晶片与炼金研究容器。
- basecamp-module-archive-v1.png：遗物档案，开放式晶体典藏库与浮动遗物。
- basecamp-module-seals-v1.png：威胁封印，绯红紫色封印祭坛与警示晶片。

五张均由 OpenAI 内置生图模型逐件生成，作为大本营入口卡整面背景使用；无文字、徽标、UI、边框和水印，标题、描述、状态由 HTML 叠加。图片使用 object-fit: cover 适配桌面三列、窄屏两列卡片。
## 首次进入动态漫画序章（2026-08-28）

- assets/story/intro-panel-01 至 intro-panel-10：从用户提供的两张 941×1672 漫画页中裁出的十个独立分镜；不在游戏中加载整页原图。裁切尽量避开原漫画标题栏、页尾标语和叙述文字框，剧情文字由 HTML 叠加。
- intro-void-transition-v1.png：由 OpenAI 内置生图模型生成的 16:9 简洁暗色晶核虚空背景，只承载分镜之间的留白、闪白和晶屑过渡。

序章分镜依次表现晶核王城、晶核破碎、长夜怪潮、守望者反应、最后晶塔、被晶塔选中、迟疑、共鸣、首领现身和元素觉醒。代码使用推近、横移、震屏、闪光与轻量晶屑实现动态漫画效果。## �ֲ����ݶ�̬�����������ƣ�2026-08-28��

���汣��ԭ�������򣬵��� 10 Ļѹ��Ϊ 6 �����½ڵ㣬����Ϊ�ɸ��õı��� + ͸��ǰ��ͼ����ϡ��ɵ� intro-panel-01 �� intro-panel-10 �زı����ڲֿ�����Ϊ��ʷ�汾�������ɵ�ǰ���¼��ء�

- assets/story/intro-bg-city-dawn-v1.png��������������ĳ��سǰ����1672��941��
- assets/story/intro-bg-ruined-wasteland-v1.png�����������ķ��汳����1672��941��
- assets/story/intro-bg-last-bastion-v1.png����������ڵ�Բ�η��汳����1672��941��
- assets/story/intro-bg-horde-night-v1.png���ֳ���Ϯ����ɫ�籩������1672��941��
- assets/story/intro-layer-crystal-core-v1.png��͸������ǰ���㣬1024��1536��
- assets/story/intro-layer-crystal-shards-v1.png��͸����Ƭ����ǰ���㣬1241��1268��
- assets/story/intro-layer-guardian-v1.png��͸�������߽�ɫ�㣬1024��1536��
- assets/story/intro-layer-monster-horde-v1.png��͸���ֳ���Ӱ�㣬1536��1024��
- assets/story/intro-layer-elemental-burst-v1.png��͸��Ԫ�ر�����Ч�㣬1536��1024��
- assets/story/intro-layer-last-tower-v1.png��͸����ҫ����ǰ���㣬1214��1295��

���ű�����Ϊ���������ֻ��棻����ǰ��ͼ��ͨ��͸�� Alpha ��顣ҳ��ͨ�� CSS �˾����볡�����������⸴����Щ�زģ��������ָ���������ʽ���ӣ�����δ�����ӽ�ɫ����֧��ϵͳ��ͷ��

## 晶塔视觉演化覆盖层（2026-09-02）

- `design/tower-style-anchor-v1.png`：同一晶塔四档演化风格锚点，统一深靛荒原、银金结构、青白守护光与克制紫色；仅作美术验收参考，不直接加载到战斗。
- `tower-route-siege-ai-v1.png`：破城炮膛双侧重型晶体炮，透明 RGBA，作为单体路线覆盖层，中心留空供基础晶塔与程序化能量核心叠加。
- `tower-route-split-ai-v1.png`：裂晶炮膛六瓣放射晶棱冠，透明 RGBA，作为群体路线覆盖层，中心留空。
- `tower-shell-panels-ai-v1.png`：超载状态四片可展开晶体护壳与散热结构，透明 RGBA，随热量和持续时间缩放。

以上资产由 OpenAI 内置生图模型生成，均使用版本化文件名；透明度抽检范围为 alpha 0–254。源文件位于 `C:\Users\0000\.codex\generated_images\01a0609c-51b3-7cd3-97a5-fa8b536fb6ef\` 对应 exec 输出目录，项目副本位于 `assets/generated/`。
## 主炮瞄准美术资产（2026-09-02）

- `tower-main-cannon-aim-ai-v1.png`：独立主炮炮口/炮管透明 RGBA 素材，炮口朝右，运行时由 Canvas 只负责旋转到目标、呼吸缩放和开火后坐力；不再绘制几何炮口。
- 源文件：`C:\Users\0000\.codex\generated_images\01a0609c-51b3-7cd3-97a5-fa8b536fb6ef\exec-4d6bef93-1692-4ae4-bcc3-71d685b3e74b.png`；项目副本：`assets/generated/tower-main-cannon-aim-ai-v1.png`。

## 四级主炮图集（2026-09-02）

- `tower-main-cannon-tiers-ai-v2.png`：1254×1254、2×2 四级主炮透明 RGBA 图集，阅读顺序为基础短晶炮、强化导轨炮、双轨重炮、终阶冠状聚能炮。
- 四级共用右向炮口和近左中部转轴；运行时按晶塔 `ascend` 等级裁切，不再缩放同一炮管伪装升级。
- 源文件：`C:\Users\0000\.codex\generated_images\01a0609c-51b3-7cd3-97a5-fa8b536fb6ef\exec-45401717-d7e0-4ad2-b1d1-8433c69c6da9.png`；项目副本：`assets/generated/tower-main-cannon-tiers-ai-v2.png`。


## 四级晶塔本体图集（2026-09-02）

- `tower-body-tiers-ai-v2.png`：1254×1254、2×2 四级晶塔本体透明 RGBA 图集；依次为低矮晶体基座、强化守卫塔座、晶簇战争塔、金白终阶堡垒。
- 四级统一地面中心和中央空炮座孔，与 `tower-main-cannon-tiers-ai-v2.png` 的环形主炮基座配套；塔身不包含炮管。
- `renderer.js` 中关键资源键 `tower` 已直接切换到本图集，四级统一按 2×2 裁切；旧 `towerUltimate` 不再加载。
- 一级格中 Alpha 行 552–626 为与主体分离的小饰件，主体位于 76–494；运行时源裁切高度限制为 520，不拉伸主体。
- 生图源：`exec-fa0ec8ef-c7bc-4061-ad2a-463e02540062.png`；透明提取源：`exec-cf7457cc-ad61-4e40-9d88-74dd18bef39d.png`；项目正式素材：`assets/generated/tower-body-tiers-ai-v2.png`。
