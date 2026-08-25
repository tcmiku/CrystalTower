# Animation Specification

Read this reference before creating or changing `animation-spec.json`.

## Purpose

The spec is the durable agreement between visual generation, deterministic image processing, QA, and engine export. Generated pixels may change during repair; clip identity, timing, directions, pivots, and gameplay events must remain explicit and reviewable.

## Required Top-Level Shape

```json
{
  "schema_version": 1,
  "project": {
    "id": "forest-hero",
    "display_name": "Forest Hero"
  },
  "subject": {
    "id": "moss-knight",
    "display_name": "Moss Knight",
    "description": "A compact moss-armored sword fighter",
    "style_notes": "hand-painted 2D, strong silhouette",
    "references": ["C:/absolute/moss-knight.png"]
  },
  "canvas": {
    "frame_width": 256,
    "frame_height": 256,
    "padding": 12,
    "pixel_art": false,
    "background": {"mode": "chroma", "color": "#FF00FF", "threshold": 72},
    "pivot": {"x": 0.5, "y": 0.92},
    "edge_policy": "clear"
  },
  "directions": {
    "mode": "screen-space",
    "values": ["south", "east", "north", "west"],
    "camera_mapping": null,
    "mirror_pairs": {"east": "west"}
  },
  "clips": [],
  "export": {
    "mode": "atlas-and-frames",
    "atlas": {"layout": "rows-by-clip", "max_width": 4096, "power_of_two": false, "format": "png"},
    "metadata": ["generic-json"]
  }
}
```

Paths stored in the spec should be absolute when they refer to inputs outside the run. Paths inside the run are relative to the run directory.

## Clip Shape

```json
{
  "id": "attack-east",
  "action": "attack",
  "direction": "east",
  "frame_count": 7,
  "fps": 14,
  "durations_ms": [71, 71, 142, 71, 71, 71, 142],
  "loop": "once",
  "root_motion": "in-place",
  "normalization": "shared-fit",
  "anchor": "pivot",
  "pivot": {"x": 0.5, "y": 0.92},
  "semantic_beats": [
    {"name": "anticipation", "frames": [0, 1]},
    {"name": "contact", "frames": [2]},
    {"name": "recovery", "frames": [3, 4, 5, 6]}
  ],
  "events": [
    {"frame": 2, "name": "hitbox_on"},
    {"frame": 3, "name": "hitbox_off"}
  ],
  "notes": "Sword remains in right hand; no projectile trail"
}
```

Rules:

- `id` is unique lowercase hyphen-case.
- `frame_count` is the number of authored images, not the number of timing samples.
- Use `durations_ms` for variable timing. If omitted, duration is derived from `fps`.
- `loop` is `loop`, `once`, `ping-pong`, or `hold-last`. Do not append a duplicate first frame to a loop; runtime playback closes it.
- `root_motion` is `in-place`, `authored`, or `metadata`. `authored` preserves within-canvas displacement. `metadata` requires a per-frame root track in `root_motion_track`.
- `normalization` is `shared-fit` or `stable-slots`. Use `stable-slots` when position inside each source slot is semantically meaningful.
- `anchor` is normally `pivot`, `bottom-center`, `center`, or a named project-specific anchor.
- `pivot` is optional per clip and overrides `canvas.pivot`; use it for attachment effects or actions with a genuinely different logical anchor.
- `root_motion_track` is required when `root_motion` is `metadata` and contains one numeric `{x,y}` displacement point per frame in project-defined units.
- Beats describe visual storytelling. Events describe gameplay timing and stay out of the pixels.

## Timing

Prefer integer `durations_ms` for final handoff even when the request begins in FPS. Use `round(1000 / fps)` as the initial uniform duration, then preserve deliberately authored holds by repeating duration, not by duplicating identical files unless the target engine requires duplicate frames.

Do not infer hit, invulnerability, footstep, spawn, or cancel frames from appearance when those values affect gameplay. Mark them unresolved or ask for project data.

## Directions

Supported modes:

- `screen-space`: left/right/up/down refer to image edges.
- `world-space`: directions refer to game axes; `camera_mapping` must explain how world directions appear on screen.
- `character-relative`: forward/back/left/right follow subject orientation; define the neutral facing.
- `none`: direction is not part of clip identity.

Use stable direction names throughout one project. Recommended sets:

- side view: `left`, `right`
- 4-way top-down: `north`, `east`, `south`, `west`
- 8-way top-down: add `north-east`, `south-east`, `south-west`, `north-west`
- isometric: define visible axes explicitly; do not assume compass labels map cleanly to screen diagonals

Cardinals are semantic hard gates. For 8-way sets, diagonals should interpolate pose and phase between adjacent cardinals instead of becoming independent redesigns.

## Pivot and Logical Canvas

Pivots are normalized coordinates in the full logical frame: `(0,0)` top-left and `(1,1)` bottom-right. The frame canvas remains fixed even if the visible sprite is small.

Use a bottom-weighted pivot for grounded characters, center for free-floating VFX, and an explicit attachment pivot for weapon/projectile effects. If a target engine uses pixels or bottom-left origin, convert only in the engine adapter; keep the canonical spec normalized and top-left based.

## Background

- Prefer real alpha when the generator can provide clean transparency.
- Otherwise use a flat chroma color absent from the subject, effects, outlines, highlights, and shadows.
- `threshold` controls deterministic removal. Increasing it can erase subject colors; inspect the alpha edge and high-contrast QA view.
- Do not use checkerboard transparency, gradients, scenery, cast shadows, or floor planes unless they are part of the intended sprite.

## Export

`mode` is `frames`, `atlas`, or `atlas-and-frames`.

The canonical atlas layout is `rows-by-clip`: each clip occupies one or more rows, frame order is preserved, and metadata is authoritative. The assembler may add transparent padding to power-of-two dimensions but never rescales frames.

`metadata` may request `generic-json`, `godot`, `unity`, `phaser`, or another project adapter. The bundled scripts always produce `generic-json`; engine-specific output is an additional derived artifact.

## Safe Prototype Defaults

When the user has not supplied production constraints and the work is explicitly a prototype, use:

- `256x256` logical frames
- `12px` clear padding
- normalized pivot `(0.5, 0.9)` for grounded characters or `(0.5, 0.5)` for effects
- `8 fps` idle, `12 fps` locomotion, `14 fps` attacks, `12 fps` VFX
- `6` idle frames, `8` locomotion frames, action-specific attacks, and no assumed directions beyond the supplied view
- `atlas-and-frames`, non-power-of-two PNG, maximum width `4096`

Record every inferred value in the spec. Defaults are starting points, not universal animation doctrine.
