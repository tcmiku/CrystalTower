# Engine Handoff

Read this reference only when exporting or integrating animation assets with a game engine.

## Canonical Metadata

`final/atlas.json` is the engine-neutral source of truth. It uses top-left pixel rectangles and normalized pivots with a top-left origin:

```json
{
  "schema_version": 1,
  "image": "atlas.png",
  "size": {"w": 2048, "h": 1024},
  "frame_canvas": {"w": 256, "h": 256},
  "frames": [
    {
      "key": "run-east/000",
      "clip": "run-east",
      "index": 0,
      "rect": {"x": 0, "y": 0, "w": 256, "h": 256},
      "duration_ms": 83,
      "pivot": {"x": 0.5, "y": 0.92},
      "events": []
    }
  ],
  "clips": [
    {
      "id": "run-east",
      "action": "run",
      "direction": "east",
      "loop": "loop",
      "frames": ["run-east/000", "run-east/001"]
    }
  ]
}
```

Generate engine-specific metadata from this file. Do not parse the contact sheet, filenames alone, or prompt text to reconstruct timing.

## Coordinate Conversion

The canonical pivot is normalized from top-left. Common conversions:

- bottom-left normalized: `(x, 1-y)`
- pixel pivot from top-left: `(x * frame_width, y * frame_height)`
- centered offset in pixels: `((x-0.5) * width, (y-0.5) * height)` with engine-specific Y sign

Confirm the target engine's texture origin, sprite pivot origin, and positive-Y direction. Do not assume them from language bindings.

## Unity

Typical handoff:

- atlas PNG/WebP supported by the project import policy
- Pixels Per Unit supplied by the project, not inferred from frame size
- filter mode `Point` for deliberate pixel art, otherwise project-defined bilinear/trilinear
- compression disabled or lossless when alpha edges or pixel art require it
- multiple-sprite rectangles from `atlas.json`
- pivot converted to Unity's bottom-left normalized convention
- AnimationClip keyframes using `duration_ms`

Do not create or modify Unity `.meta`, `.anim`, or controller files unless the user asks and the project version/import conventions are known.

## Godot

For a uniform atlas, `SpriteFrames`/`AtlasTexture` can use rectangles from `atlas.json`. Preserve variable frame durations when using Godot versions and nodes that support them; otherwise duplicate timing samples only as an engine adapter artifact, not in canonical frames.

Godot normalized region/pivot conventions depend on the chosen node and centered/offset settings. Test one idle and one directional action in the actual scene before bulk-import assumptions.

## Phaser and Web Runtimes

Phaser can consume a JSON atlas plus animation definitions. Use frame keys from `atlas.json`, convert `duration_ms` directly where supported, and preserve `loop` versus `once`. Set texture filtering based on art style and CSS/canvas scale.

For canvas/WebGL runtimes, guard against texture bleeding with nearest sampling for pixel art and transparent atlas padding. Do not crop the logical frame unless the runtime also receives pivot and source-size metadata.

## Aseprite Compatibility

The generic atlas metadata resembles Aseprite's concepts but is not an Aseprite JSON clone. If the user requests Aseprite JSON, emit a dedicated adapter with `frames` and `meta.frameTags`, verify tag direction semantics, and preserve per-frame durations.

## Texture Constraints

Apply engine constraints only when requested:

- power-of-two atlas dimensions
- maximum texture width/height
- PNG versus lossless WebP support
- premultiplied versus straight alpha
- color space and texture compression
- padding/extrusion rules
- naming and resource-path conventions

If the atlas exceeds a maximum texture dimension, split it deterministically into pages and include page id per frame. Never rescale frames merely to fit without explicit approval.

## Integration Smoke Test

Before claiming engine readiness:

1. load one looping clip and verify cadence
2. load one one-shot clip and verify its end transition
3. verify a directional family uses the intended coordinate mapping
4. check pivot stability in motion
5. check alpha edges on light and dark backgrounds
6. confirm event timing on at least one gameplay-sensitive clip

Report adapter output separately from the canonical frames and metadata so engine-specific regeneration never requires re-generating artwork.
