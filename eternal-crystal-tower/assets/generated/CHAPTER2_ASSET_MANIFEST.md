# 第二章《极夜航道》生图资产

生成日期：2026-08-31。

动态海域前景：chapter2-polar-sea-foreground-ai-v3.png，1448×1086 RGBA，只保留外围礁体、导航残骸、浮标与雾；中心像素 Alpha=0。抽样中 26.6% 完全透明，另有半透明雾和抗锯齿边缘。renderer.js 的 drawChapterTwoWater 在其下绘制动态水面；透明前景缺失时回退原始静态海域。

统一风格锚点：`premium top-down naval fantasy game asset, hand-painted 2D with angular hard-surface silhouettes, restrained painterly texture, deep ocean indigo shadows, cyan-teal guardian light and coral-red hostile signals, crisp readable forms at small scale, no text, no logo, no watermark, no photorealism.`

- `chapter2-polar-sea-ai-v1.png`：1448×1086 全幅极夜海域战场，中央低细节、四向航道、外圈冷雾与导航残骸。
- `chapter2-hive-carrier-ai-v1.png`：1859×846 RGBA 永耀蜂巢无人机航母，横向朝右，双舰首、中央反应堆与七个甲板接口。
- `chapter2-enemy-fleet-atlas-ai-v1.png`：1536×1024 RGBA 2×2 敌舰图集，快艇、铁甲舰、导弹舰与深潜艇。
- `chapter2-drone-atlas-ai-v1.png`：1254×1254 RGBA 2×2 无人机图集，打捞、强袭、护盾与超频四种状态。
- `chapter2-abyss-sovereign-ai-v1.png`：1024×1536 RGBA 终局渊潮王舰，四命核、双侧攻城舱与纵向冠状舰首。

透明验收：四张单位素材的四角 Alpha 为 0（敌舰图集单个角为抗锯齿值 1），背景为 24bpp 不透明全幅图。全部资产由 OpenAI 内置生图模型逐张生成；完整提示词记录在 `CHAPTER2_ART_PROMPTS.md`。渲染器使用第二章专属视觉键，缺图时回退 Canvas 几何图形。
