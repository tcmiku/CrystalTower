# 裂隙行商 · 弥罗生图记录

生成日期：2026-08-30。工具：OpenAI 内置生图模型。

## 首轮生成

```text
Use case: stylized-concept
Asset type: single transparent production NPC sprite for a top-down 2D crystal tower-defense game
Primary request: create an original female interdimensional merchant named Miro, a calm and formidable rift trader who appears at the battlefield edge during late endless mode
Subject: one adult woman with a confident composed expression, long dark-violet hair tied back with two loose strands, an asymmetrical indigo travel coat over fitted silver-and-pale-gold crystal armor, a compact belt of sealed crystal vials and coin tokens, one elegant staff topped by a small contained violet rift ring, and a folded dark mantle shaped like merchant awnings; unmistakably a trader rather than a combat enemy
View/pose: orthographic top-down 2D game sprite with a restrained elevated angle matching a tower-defense battlefield; standing three-quarter pose facing toward the battlefield center, full body visible, staff held close, one free hand offering a small glowing crystal token
Style/medium: premium hand-painted 2D fantasy game sprite, faceted crystal hard edges, restrained painterly texture, dark fantasy crystal technology, original production-ready cutout, no photorealism
Composition/framing: one character only, centered on a portrait canvas, generous transparent padding, complete silhouette with head boots staff and coat fully visible, no crop; readable at approximately 90–150 in-game pixels
Lighting/mood: controlled cyan-violet guardian rim light, deep indigo shadows, small warm gold highlights on trade tokens, subtle contained magenta rift glow; central tower must remain visually brighter than this NPC
Color palette: deep indigo, charcoal violet, silver, restrained pale gold, cyan-violet crystal accents, sparse magenta rift light
Materials/textures: faceted crystal clasps, worn heavy travel fabric, brushed silver armor, polished coin tokens
Constraints: clearly female adult human character; genuine transparent background with alpha; no backdrop, no checkerboard, no ground plane, no cast shadow, no UI, no price tags, no readable text, no logo, no watermark, no separate creatures, no particles beyond a tight self-contained glow
Avoid: male or androgynous silhouette, sexualized outfit, oversized cleavage, childlike proportions, enemy monster traits, combat attack pose, photorealism, anime cel shading, excessive bloom, blur, multiple characters
Style anchor: premium top-down fantasy tower-defense game asset, hand-painted 2D with faceted crystal hard edges, restrained painterly texture, deep indigo shadows, cyan-violet guardian light and ember-red corruption, crisp readable silhouette at small scale, no text, no logo, no watermark.
```

## 背景提取编辑

```text
Use case: background-extraction
Asset type: transparent production NPC sprite for a top-down 2D crystal tower-defense game
Input images: Image 1 is the edit target
Primary request: remove only the entire dark rectangular background and atmospheric backdrop, producing a clean isolated cutout of the female merchant, her backpack awning, staff, clothing, hair, offered token, and all attached equipment on a genuinely transparent alpha background
Invariants: keep the woman’s face, female identity, expression, body proportions, pose, hair, armor, coat, backpack awning, staff, rift ring, vials, coins, crystal token, materials, colors, framing, scale, and every internal highlight unchanged; do not redesign or repaint the character
Constraints: genuine alpha transparency outside the complete character silhouette; preserve fine hair edges, fabric tassels, staff ribbons, crystal edges, and tight self-contained glow; no checkerboard, no flat color backdrop, no ground, no cast shadow, no text, no logo, no watermark
Avoid: cropping, changing anatomy, changing costume, removing carried merchant equipment, adding any new object, leaving dark halos or opaque corners.
```

项目文件：

- `npc-rift-merchant-miro-portrait-ai-v1.png`：商店页眉头像，使用首轮生成。
- `npc-rift-merchant-miro-ai-v1.png`：战场 NPC 精灵，使用背景提取版本。模型仍烘焙了浅色棋盘底，游戏加载时通过边缘连通背景移除生成透明 Canvas 切图。

原始生成结果：

- `/Users/mac/.codex/generated_images/01a05115-4304-7520-a878-7f93a57e1db7/exec-cdf81eba-5b9c-4777-8efc-09a9363fc5a0.png`
- `/Users/mac/.codex/generated_images/01a05115-4304-7520-a878-7f93a57e1db7/exec-c52098cc-458a-4fc8-895c-7bca1fb25feb.png`

## 紧凑 HUD 图标（2026-08-30）

```text
Use case: stylized-concept
Asset type: small square transparent UI icon for a dark sci-fi roguelite game
Create a readable merchant avatar icon for “裂隙行商·弥罗”, a mysterious female dimensional-rift merchant. Show only a head-and-shoulders portrait, centered and tightly framed for display at 32–52 px. She has long dark violet hair, luminous amethyst eyes, a silver-gold crystal hood/collar, and one tiny violet rift-ring ornament with a subtle coin glint. High-contrast silhouette, crisp painterly game concept art, elegant and slightly enigmatic expression, violet and gold rim light. Transparent background with clean alpha around the silhouette; no checkerboard pattern, no flat backdrop, no text, no UI frame, no watermark, no extra characters. Keep facial features and the rift ornament legible at icon size.
```

生成文件：`npc-rift-merchant-miro-icon-ai-v1.png`（RGBA，1254×1254）。
