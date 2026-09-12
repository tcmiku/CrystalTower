# 晶塔三维模型

四阶模型依据现有 `tower-body-tiers-ai-v2.png` 与 `tower-main-cannon-tiers-ai-v2.png` 重建：深蓝分层装甲、银金镶边、青紫多面晶簇、实体晶能主炮。GLB 中保留独立炮座转向节点、炮管后坐节点与过载排热片。

- 模型源：`src/tower-model.js`，运行时由同一份几何定义构建，使用 WebGL 深度缓冲绘制并合成到战场 Canvas。
- 预览：`/tower-model-preview.html`，可对照四阶、切换炮膛/元素/热状态、旋转检视。
- 导出：`node scripts/export-tower-models.mjs`，生成四个标准炮膛 GLB；游戏中的炮膛和元素变体由同一模型构建器生成。
- 模型坐标 Y 向上，炮管局部 +X 为发射方向；导出根节点缩放 0.01。
- GLB 使用顶点色和 PBR 材质。游戏专用的热量变色、脉冲亮度、护盾及受击特效由运行时驱动，未烘焙进 GLB。
- 无 WebGL 时使用同一网格的软件投影回退；该回退采用三角面排序，极端交叠的精度低于 GPU 深度缓冲。

### 拼装模块模型

八种模块已导出为 `module-pulse.glb`、`module-cannon.glb`、`module-blade.glb`、`module-hangar.glb`、`module-shield.glb`、`module-frost.glb`、`module-fire.glb`、`module-lightning.glb`。它们使用游戏中的同源网格，Y 轴向上，局部 X 轴为长边；GLB 为 I 级独立资产。

运行 `node scripts/export-module-models.mjs` 重新导出。打开 `module-model-preview.html` 查看塔身挂载、不同配置、等级及环视效果。运行时由 `src/module-model.js` 根据拼装格号对应的塔壁扇区、方向和等级生成外挂部件，随装配状态刷新；不会在每个战斗帧重建网格。

### 常见小怪三维模型

十种第一章小怪使用程序化三维模型。原有七种依据 `assets/generated/enemy-atlas.png` 重建：暗紫岩甲、熔火裂隙、红晶轮廓。新增异星小怪保留青光、银白、酸绿的类型识别色。

| 类型 | GLB | 要点 |
| --- | --- | --- |
| wisp 熔晶浮灵 | `enemy-wisp.glb` | 岩甲球体 + 熔火竖瞳 + 四瓣弯爪 |
| runner 疾行兽 | `enemy-runner.glb` | 低伏箭形头 + 背脊晶脊 + 四足 |
| brute 重甲兽 | `enemy-brute.glb` | 宽重躯干 + 巨型前爪 + 肩晶 |
| crawler 爬行怪 | `enemy-crawler.glb` | 六足蟹甲 + 后钳 |
| sentinel 晶甲守卫 | `enemy-sentinel.glb` | 盾晶侧甲 + 高耸晶冠 |
| hexer 咒晶怪 | `enemy-hexer.glb` | 紫晶球体 + 三枚环绕法术浮晶 |
| rammer 冲撞兽 | `enemy-rammer.glb` | 前向撞角晶矛 + 橙热裂隙 |
| inkHound 墨影猎犬 | `enemy-inkHound.glb` | 低伏四足 + 双耳晶角 + 青光脊线 |
| orbitMote 轨道微星 | `enemy-orbitMote.glb` | 悬浮晶核 + 交错双环 + 三枚卫星晶体 |
| rustBeetle 锈蚀甲虫 | `enemy-rustBeetle.glb` | 分瓣锈甲 + 六足 + 酸绿裂隙 |

- 模型源：`src/enemy-model.js`，与晶塔共用 `meshBuilder` 与 `TowerModelRenderer` 管线。
- 预览：`/enemy-model-preview.html`，下拉切换十种并环视；`/combat-model-preview.html` 对照新增模型。
- 导出：`node scripts/export-enemy-models.mjs`。
- 自检渲染：`node scripts/render-enemy-model-previews.mjs` → `qa/screenshots/enemy-3d-*.svg`。
- 坐标与晶塔一致：Y 向上，局部 +X 为朝向晶塔的前进方向；根节点缩放 0.01。
- 战斗中第一章普通怪走 3D；怪潮密集时除浮灵外仍回退图集精灵以保帧率；第二章舰种不使用这些网格。

模块化晶塔采用完整圆形塔身、分层装甲、中央晶核塔冠和能量环。模块以短支架和弧形固定座挂在塔壁外侧；六格仅用于装配管理，不对应实体甲板或平台。晶核与分段能量环具有悬浮和旋转动画。轻炮、重炮的活动炮组与固定底盘分离，按各自开火事件播放后坐与炮口闪光。`module-model-preview.html` 的“演示模块攻击”可查看动作。

`node scripts/export-modular-chassis.mjs` 导出四阶空塔 `modular-chassis-tier-1.glb` 至 `modular-chassis-tier-4.glb`；导出的是静态网格，实时动画由游戏渲染器驱动。

组件动态特效由 `src/module-effects.js` 生成并与挂点同步：轻炮导轨流光、重炮蓄能环、环刃实体旋转和拖尾、机库扫描与航灯、护盾扩散波、霜粒、炉焰余烬、双极电弧。特效不使用战斗随机数，也不累积粒子对象；拆卸组件会同步停止特效。预览页的单组件卡片只在可见时更新动画。

攻击增强由真实战斗事件驱动：独立炮口喷焰与冲击环、晶刃扩散弧、机库出舱光、扇区格挡脉冲、冰晶爆散、炉焰喷发、放射雷弧。每个模块最多保留一个 0.45 秒衰减计时；每次采样不超过 16 条路径，连续攻击刷新而不叠加粒子。炮口特效跟随各自武器的瞄准角。

### 战斗晶刃

`crystal-blade.glb` 是独立的六翼晶刃，含厚刃、倒角、轮毂和发光晶核，共 402 个三角面。`src/blade-geometry.js` 同时供塔上转子和飞行晶刃使用；`src/blade-model.js` 在环绕、弹射和返程阶段绘制同一网格，支持 WebGL 与软件回退。返程保留青色尾迹，环绕阶段具有分层弧形流光。

运行 `node scripts/export-module-models.mjs` 同时生成晶刃和八种模块 GLB。打开 `/combat-model-preview.html` 可旋转检视并下载晶刃及三种新小怪。
