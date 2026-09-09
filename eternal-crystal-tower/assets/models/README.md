# 晶塔三维模型

四阶模型依据现有 `tower-body-tiers-ai-v2.png` 与 `tower-main-cannon-tiers-ai-v2.png` 重建：深蓝分层装甲、银金镶边、青紫多面晶簇、实体晶能主炮。GLB 中保留独立炮座转向节点、炮管后坐节点与过载排热片。

- 模型源：`src/tower-model.js`，运行时由同一份几何定义构建，使用 WebGL 深度缓冲绘制并合成到战场 Canvas。
- 预览：`/tower-model-preview.html`，可对照四阶、切换炮膛/元素/热状态、旋转检视。
- 导出：`node scripts/export-tower-models.mjs`，生成四个标准炮膛 GLB；游戏中的炮膛和元素变体由同一模型构建器生成。
- 模型坐标 Y 向上，炮管局部 +X 为发射方向；导出根节点缩放 0.01。
- GLB 使用顶点色和 PBR 材质。游戏专用的热量变色、脉冲亮度、护盾及受击特效由运行时驱动，未烘焙进 GLB。
- 无 WebGL 时使用同一网格的软件投影回退；该回退采用三角面排序，极端交叠的精度低于 GPU 深度缓冲。
